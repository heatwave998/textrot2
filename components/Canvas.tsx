
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import { DesignState, Point, TextLayer } from '../types';
import { Upload, Maximize2, PenTool, RotateCw, Move as MoveIcon } from 'lucide-react';

interface CanvasProps {
  imageSrc: string | null;
  design: DesignState;
  enableZoom: boolean;
  className?: string;
  onImageUpload: (file: File) => void;
  onPathDrawn: (points: Point[]) => void;
  onUpdateDesign: (updates: Partial<DesignState>) => void;
}

export interface CanvasHandle {
  exportImage: () => Promise<string>;
  triggerFileUpload: () => void;
}

// Helper: Hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Helper: Hex to RGBA
const hexToRgba = (hex: string, alpha: number) => {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

// Helper: Interpolate Colors
const interpolateColor = (c1: string, c2: string, t: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
    return `rgb(${r},${g},${b})`;
};

// Helper: Iterative Weighted Moving Average for Smoothing
const getSmoothedPoints = (points: Point[], iterations: number): Point[] => {
    if (points.length < 3 || iterations <= 0) return points;
    
    let currentPoints = [...points];
    
    // Apply smoothing iterations
    for (let k = 0; k < iterations; k++) {
        const nextPoints = [...currentPoints];
        // Skip first and last point to anchor the ends
        for (let i = 1; i < currentPoints.length - 1; i++) {
            const prev = currentPoints[i - 1];
            const curr = currentPoints[i];
            const next = currentPoints[i + 1];

            nextPoints[i] = {
                x: prev.x * 0.15 + curr.x * 0.7 + next.x * 0.15,
                y: prev.y * 0.15 + curr.y * 0.7 + next.y * 0.15
            };
        }
        currentPoints = nextPoints;
    }
    return currentPoints;
};

// Helper: Get text metrics (Tight Ink Bounds)
const measureLineMetrics = (ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) => {
    const chars = text.split('');
    let currentX = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    
    // If empty
    if (chars.length === 0) return { inkLeft: 0, inkRight: 0, inkWidth: 0, advanceWidth: 0 };

    chars.forEach((char, i) => {
        const metrics = ctx.measureText(char);
        // Actual ink bounds relative to current cursor position
        const charInkLeft = currentX - metrics.actualBoundingBoxLeft;
        const charInkRight = currentX + metrics.actualBoundingBoxRight;
        
        if (charInkLeft < minX) minX = charInkLeft;
        if (charInkRight > maxX) maxX = charInkRight;
        
        currentX += metrics.width + (i < chars.length - 1 ? letterSpacing : 0);
    });

    return {
        inkLeft: minX,
        inkRight: maxX,
        inkWidth: maxX - minX,
        advanceWidth: currentX
    };
};

const measureTextLayout = (ctx: CanvasRenderingContext2D, layer: TextLayer, width: number) => {
    const fontSize = (layer.textSize / 100) * width;
    ctx.font = `${layer.isItalic ? 'italic' : 'normal'} ${layer.isBold ? 'bold' : 'normal'} ${fontSize}px "${layer.fontFamily}"`;
    
    const scaledLetterSpacing = layer.letterSpacing * (fontSize / 50);
    const rawText = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
    const lines = rawText.split('\n');
    const lineHeight = fontSize * 1.0; // Tight line height matching font size
    const totalHeight = lines.length * lineHeight;

    let maxInkWidth = 0;

    lines.forEach(line => {
        const metrics = measureLineMetrics(ctx, line, scaledLetterSpacing);
        if (metrics.inkWidth > maxInkWidth) maxInkWidth = metrics.inkWidth;
    });

    // Add a tiny buffer for handles so they don't clip exact pixels
    const buffer = fontSize * 0.1; 
    return { width: maxInkWidth + buffer, height: totalHeight };
};

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ imageSrc, design, enableZoom, className, onImageUpload, onPathDrawn, onUpdateDesign }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Scratch canvas for offscreen composition
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Store the actual loaded image for rendering onto canvas
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState<{ w: number, h: number } | null>(null);
  
  // Interaction States
  const [interactionMode, setInteractionMode] = useState<'NONE' | 'PAN' | 'DRAW_PATH' | 'MOVE_PATH' | 'GIZMO_MOVE' | 'GIZMO_SCALE' | 'GIZMO_ROTATE'>('NONE');
  const [activeGizmoHandle, setActiveGizmoHandle] = useState<string | null>(null);

  // Refs for drag calculations
  const dragStartRef = useRef({ x: 0, y: 0 }); // Screen coordinates
  const initialLayerRef = useRef<TextLayer | null>(null); // Snapshot of layer at drag start
  const currentPathRef = useRef<Point[]>([]);
  
  // Metrics for Gizmo
  const [textBounds, setTextBounds] = useState({ width: 0, height: 0 });

  const activeLayer = design.layers.find(l => l.id === design.activeLayerId);

  // Helper to lazily get or create scratch canvas
  const getScratchCanvas = (width: number, height: number) => {
      if (!scratchCanvasRef.current) {
          scratchCanvasRef.current = document.createElement('canvas');
      }
      const canvas = scratchCanvasRef.current;
      if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
      }
      return canvas;
  };

  // Reset zoom and get dims when the image changes
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    
    if (imageSrc) {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => {
            bgImageRef.current = i;
            setImgDims({ w: i.naturalWidth, h: i.naturalHeight });
        };
        i.onerror = () => {
            console.error("Failed to load image dimensions");
            bgImageRef.current = null;
            setImgDims(null); 
        };
        i.src = imageSrc;
    } else {
        bgImageRef.current = null;
        setImgDims(null);
    }
  }, [imageSrc]);

  // Update Text Bounds when active layer changes
  useEffect(() => {
      if (textCanvasRef.current && imgDims && activeLayer) {
          const ctx = textCanvasRef.current.getContext('2d');
          if (ctx) {
              const metrics = measureTextLayout(ctx, activeLayer, imgDims.w);
              setTextBounds(metrics);
          }
      }
  }, [activeLayer, imgDims]);

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom || !imageSrc) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Mouse position relative to the center of the container
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const scaleAmount = -e.deltaY * 0.001; 
    const nextScale = Math.min(Math.max(0.1, zoomScale + scaleAmount), 5); 
    
    // Only update pan if scale actually changes
    if (nextScale !== zoomScale) {
        // Calculate new pan so that the point under the mouse stays under the mouse
        const scaleRatio = nextScale / zoomScale;
        const newPanX = mouseX - (mouseX - pan.x) * scaleRatio;
        const newPanY = mouseY - (mouseY - pan.y) * scaleRatio;

        setPan({ x: newPanX, y: newPanY });
        setZoomScale(nextScale);
    }
  };

  // Helper to map screen event coordinates to Intrinsic Image Coordinates
  const getIntrinsicCoordinates = (e: React.MouseEvent) => {
      if (!containerRef.current || !imgDims) return null;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      return {
          x: relX * imgDims.w,
          y: relY * imgDims.h
      };
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!imageSrc || !imgDims) return;
      const coords = getIntrinsicCoordinates(e);
      if (!coords) return;

      // 1. Gizmo Interactions (Stop Propagation to prevent Panning/Drawing)
      const target = e.target as HTMLElement;
      // Use closest because the handle might have child elements (icons)
      const handleEl = target.closest('[data-handle]');
      const handleType = handleEl?.getAttribute('data-handle');

      if (handleType && activeLayer) {
          e.preventDefault();
          e.stopPropagation();
          initialLayerRef.current = { ...activeLayer };
          dragStartRef.current = { x: e.clientX, y: e.clientY };

          if (handleType === 'rotate') {
              setInteractionMode('GIZMO_ROTATE');
              setActiveGizmoHandle(handleType);
          } else if (['tl', 'tr', 'bl', 'br'].includes(handleType)) {
              setInteractionMode('GIZMO_SCALE');
              setActiveGizmoHandle(handleType);
          } else if (handleType === 'box') {
              setInteractionMode('GIZMO_MOVE');
              setActiveGizmoHandle(handleType);
          }
          return;
      }

      // 2. Path Mode interactions
      if (activeLayer?.isPathInputMode) {
          e.preventDefault();
          setInteractionMode('DRAW_PATH');
          currentPathRef.current = [coords];
          return;
      }

      if (activeLayer?.isPathMoveMode && activeLayer.pathPoints.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setInteractionMode('MOVE_PATH');
          initialLayerRef.current = { ...activeLayer }; // Store points snapshot
          dragStartRef.current = { x: coords.x, y: coords.y }; // Use intrinsic for path move
          return;
      }

      // 3. Panning (Default Left Click)
      if (enableZoom && e.button === 0) {
          setInteractionMode('PAN');
          dragStartRef.current = {
              x: e.clientX - pan.x,
              y: e.clientY - pan.y
          };
          e.preventDefault();
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const coords = getIntrinsicCoordinates(e);
      if (!imgDims) return;

      if (interactionMode === 'DRAW_PATH') {
          if (!coords) return;
          currentPathRef.current.push(coords);
          renderToContext(textCanvasRef.current?.getContext('2d') || null, imgDims.w, imgDims.h, true);
          return;
      }

      if (interactionMode === 'MOVE_PATH') {
           if (!coords || !initialLayerRef.current) return;
           e.preventDefault();
           
           const dx = coords.x - dragStartRef.current.x;
           const dy = coords.y - dragStartRef.current.y;
           
           const newPoints = initialLayerRef.current.pathPoints.map(p => ({
               x: p.x + dx,
               y: p.y + dy
           }));
           
           onPathDrawn(newPoints);
           return;
      }

      if (interactionMode === 'PAN') {
          e.preventDefault();
          setPan({
              x: e.clientX - dragStartRef.current.x,
              y: e.clientY - dragStartRef.current.y
          });
          return;
      }

      // --- GIZMO LOGIC ---
      if (['GIZMO_MOVE', 'GIZMO_SCALE', 'GIZMO_ROTATE'].includes(interactionMode)) {
          e.preventDefault();
          if (!initialLayerRef.current || !activeLayer) return;

          const startLayer = initialLayerRef.current;
          const updatedLayers = design.layers.map(l => {
              if (l.id !== activeLayer.id) return l;

              if (interactionMode === 'GIZMO_MOVE') {
                   // Calculate delta in intrinsic pixels
                   const rect = containerRef.current!.getBoundingClientRect();
                   const scaleFactor = imgDims.w / rect.width;
                   
                   const dxScreen = e.clientX - dragStartRef.current.x;
                   const dyScreen = e.clientY - dragStartRef.current.y;
                   
                   const dxIntrinsic = dxScreen * scaleFactor;
                   const dyIntrinsic = dyScreen * scaleFactor;
                   
                   const dxPercent = (dxIntrinsic / imgDims.w) * 100;
                   const dyPercent = (dyIntrinsic / imgDims.h) * 100;

                   return {
                       ...l,
                       overlayPosition: {
                           x: Math.max(0, Math.min(100, startLayer.overlayPosition.x + dxPercent)),
                           y: Math.max(0, Math.min(100, startLayer.overlayPosition.y + dyPercent))
                       }
                   };
              }

              if (interactionMode === 'GIZMO_SCALE') {
                   const rect = containerRef.current!.getBoundingClientRect();
                   const cx = rect.left + (startLayer.overlayPosition.x / 100) * rect.width;
                   const cy = rect.top + (startLayer.overlayPosition.y / 100) * rect.height;
                   
                   const startDist = Math.hypot(dragStartRef.current.x - cx, dragStartRef.current.y - cy);
                   const currDist = Math.hypot(e.clientX - cx, e.clientY - cy);
                   
                   const ratio = currDist / (startDist || 1);
                   const newSize = Math.min(50, Math.max(0.1, startLayer.textSize * ratio));
                   
                   return { ...l, textSize: newSize };
              }

              if (interactionMode === 'GIZMO_ROTATE') {
                   const rect = containerRef.current!.getBoundingClientRect();
                   const cx = rect.left + (startLayer.overlayPosition.x / 100) * rect.width;
                   const cy = rect.top + (startLayer.overlayPosition.y / 100) * rect.height;
                   
                   const angleRad = Math.atan2(e.clientY - cy, e.clientX - cx);
                   let angleDeg = angleRad * (180 / Math.PI) + 90; 
                   
                   if (angleDeg < 0) angleDeg += 360;
                   
                   if (e.shiftKey) {
                       angleDeg = Math.round(angleDeg / 15) * 15;
                   }

                   return { ...l, rotation: Math.round(angleDeg) };
              }
              return l;
          });

          onUpdateDesign({ layers: updatedLayers });
      }
  };

  const handleMouseUp = () => {
      if (interactionMode === 'DRAW_PATH') {
          onPathDrawn(currentPathRef.current);
          currentPathRef.current = [];
      }
      setInteractionMode('NONE');
      setActiveGizmoHandle(null);
      initialLayerRef.current = null;
  };


  // --- Core Rendering Logic ---
  // Renders the visual content of the layer (Text, Path, Effects) to the given context.
  // This does NOT handle Shadow application; shadow is handled via composition in renderToContext.
  const renderLayerVisuals = (
      ctx: CanvasRenderingContext2D,
      layer: TextLayer,
      width: number,
      height: number,
      isPreview: boolean
  ) => {
    if (!layer.visible) return;

    const isActive = layer.id === design.activeLayerId;
    
    // Set Base Context State
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    // We use source-over for the scratch buffer always
    ctx.globalCompositeOperation = 'source-over';

    const activePointsRaw = (interactionMode === 'DRAW_PATH' && isActive) ? currentPathRef.current : layer.pathPoints;
    const activePoints = (interactionMode === 'DRAW_PATH' && isActive) ? activePointsRaw : getSmoothedPoints(activePointsRaw, layer.pathSmoothing);

    const showPathLine = isPreview && isActive && (
        (interactionMode === 'DRAW_PATH' && activePoints.length > 1) ||
        (layer.isPathMoveMode && activePoints.length > 1)
    );

    if (showPathLine) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#ec4899'; 
        ctx.lineWidth = Math.max(2, width * 0.003); 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (layer.isPathMoveMode && interactionMode !== 'DRAW_PATH') {
             ctx.setLineDash([15, 15]); 
             ctx.globalAlpha = 0.6;
        }
        
        ctx.moveTo(activePoints[0].x, activePoints[0].y);
        for(const p of activePoints) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
        
        if (interactionMode === 'DRAW_PATH') return; 
    }

    const fontSize = (layer.textSize / 100) * width;
    const fontWeight = layer.isBold ? 'bold' : 'normal';
    const fontStyle = layer.isItalic ? 'italic' : 'normal';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${layer.fontFamily}"`;
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'middle';

    const scaledLetterSpacing = layer.letterSpacing * (fontSize / 50); 
    const rawText = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
    const lines = rawText.split('\n');
    const lineHeight = fontSize * 1.0; 
    const totalHeight = lines.length * lineHeight;

    let maxInkWidth = 0;
    const lineMetrics = lines.map(line => {
        const m = measureLineMetrics(ctx, line, scaledLetterSpacing);
        if (m.inkWidth > maxInkWidth) maxInkWidth = m.inkWidth;
        return m;
    });

    let normalModeFillStyle: string | CanvasGradient = layer.textColor;
    
    if (layer.specialEffect === 'gradient' && !layer.isHollow) {
        const r = Math.sqrt((maxInkWidth/2)**2 + (totalHeight/2)**2);
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        const x1 = -Math.cos(angleRad) * r;
        const y1 = -Math.sin(angleRad) * r;
        const x2 = Math.cos(angleRad) * r;
        const y2 = Math.sin(angleRad) * r;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        const halfSpread = layer.effectIntensity / 2; 
        const stop1 = Math.max(0, Math.min(1, (50 - halfSpread) / 100));
        const stop2 = Math.max(0, Math.min(1, (50 + halfSpread) / 100));

        grad.addColorStop(stop1, layer.textColor);
        grad.addColorStop(stop2, layer.effectColor);
        normalModeFillStyle = grad;
    }

    const drawTextItem = (
        text: string, 
        offsetX: number, 
        offsetY: number, 
        colorOverride?: string, 
        forceHollow?: boolean, 
        disableOutline: boolean = false
    ) => {
        const isHollow = forceHollow !== undefined ? forceHollow : layer.isHollow;
        const shouldDrawOutline = !disableOutline && layer.hasOutline;

        ctx.save();

        if (activePoints && activePoints.length > 1) {
            const path = activePoints;
            const distances = [0];
            for (let i = 1; i < path.length; i++) {
                const dx = path[i].x - path[i-1].x;
                const dy = path[i].y - path[i-1].y;
                distances.push(distances[i-1] + Math.sqrt(dx*dx + dy*dy));
            }
            const totalPathLen = distances[distances.length - 1];

            let totalTextWidth = 0;
            for (const char of text) {
                totalTextWidth += ctx.measureText(char).width + scaledLetterSpacing;
            }

            let currentDist = 0;
            if (layer.textAlign === 'center') currentDist = (totalPathLen - totalTextWidth) / 2;
            if (layer.textAlign === 'right') currentDist = totalPathLen - totalTextWidth;
            
            currentDist += offsetX;
            const normalOffset = offsetY;

            for (const char of text) {
                const charWidth = ctx.measureText(char).width;
                const charMidDist = currentDist + (charWidth / 2);

                if (charMidDist >= 0 && charMidDist <= totalPathLen) {
                    let idx = 0;
                    while (distances[idx + 1] < charMidDist && idx < distances.length - 2) {
                        idx++;
                    }
                    
                    const p1 = path[idx];
                    const p2 = path[idx+1];
                    const segStart = distances[idx];
                    const segLen = distances[idx+1] - segStart;
                    const t = (charMidDist - segStart) / (segLen || 1); 

                    const xBase = p1.x + (p2.x - p1.x) * t;
                    const yBase = p1.y + (p2.y - p1.y) * t;
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                    const xFinal = xBase + Math.sin(angle) * normalOffset; 
                    const yFinal = yBase - Math.cos(angle) * normalOffset; 
                    
                    const letterRotRad = (layer.letterRotation * Math.PI) / 180;
                    const totalRotation = angle + letterRotRad;

                    // Per-character isolation
                    ctx.save(); 

                    ctx.translate(xFinal, yFinal);
                    ctx.rotate(totalRotation);
                    
                    let activeFill = colorOverride || layer.textColor;
                    if (!colorOverride && layer.specialEffect === 'gradient' && !isHollow) {
                        const gradT = Math.max(0, Math.min(1, charMidDist / totalPathLen));
                        activeFill = interpolateColor(layer.textColor, layer.effectColor, gradT);
                    }

                    if (isHollow) {
                         ctx.lineWidth = layer.hasOutline ? layer.outlineWidth : 2; 
                         ctx.strokeStyle = colorOverride || (layer.hasOutline ? layer.outlineColor : layer.textColor);
                         ctx.strokeText(char, 0, 0);
                    } else {
                         ctx.fillStyle = activeFill;
                         ctx.fillText(char, 0, 0);
                         
                         if (shouldDrawOutline) {
                             ctx.lineWidth = layer.outlineWidth;
                             ctx.strokeStyle = layer.outlineColor;
                             ctx.strokeText(char, 0, 0);
                         }
                    }

                    ctx.restore();
                }
                currentDist += charWidth + scaledLetterSpacing;
            }

        } else {
            const xPos = (layer.overlayPosition.x / 100) * width;
            const yPos = (layer.overlayPosition.y / 100) * height;
            
            ctx.translate(xPos, yPos);
            
            // Standard Rotation
            const mainRotation = layer.rotation;
            const mainRotationRad = (mainRotation * Math.PI) / 180;
            if (mainRotation !== 0) ctx.rotate(mainRotationRad);
            
            const sX = layer.flipX ? -1 : 1;
            const sY = layer.flipY ? -1 : 1;
            if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);

            const startY = -(totalHeight / 2) + (lineHeight / 2);

            lines.forEach((line, i) => {
                const lineY = startY + (i * lineHeight) + offsetY;
                const m = lineMetrics[i];
                const chars = line.split('');
                
                let startX = 0;
                
                if (layer.textAlign === 'left') {
                    startX = -(maxInkWidth / 2) - m.inkLeft;
                } else if (layer.textAlign === 'right') {
                    startX = (maxInkWidth / 2) - m.inkRight;
                } else {
                    const inkCenter = (m.inkLeft + m.inkRight) / 2;
                    startX = -inkCenter;
                }
                
                let currentAdvance = startX + offsetX;
                chars.forEach((char, idx) => {
                    const charW = ctx.measureText(char).width;
                    const letterRotRad = (layer.letterRotation * Math.PI) / 180;
                    
                    const isRotated = layer.letterRotation !== 0;
                    
                    ctx.save();
                    
                    const centerX = currentAdvance + charW / 2;
                    const centerY = lineY; 
                    
                    ctx.translate(centerX, centerY);
                    if (isRotated) ctx.rotate(letterRotRad);
                    ctx.translate(-centerX, -centerY);

                    if (isHollow) {
                        ctx.lineWidth = layer.hasOutline ? layer.outlineWidth : 2; 
                        ctx.strokeStyle = colorOverride || (layer.hasOutline ? layer.outlineColor : layer.textColor);
                        ctx.strokeText(char, currentAdvance, lineY);
                    } else {
                        ctx.fillStyle = colorOverride || normalModeFillStyle;
                        ctx.fillText(char, currentAdvance, lineY);
                        
                        if (shouldDrawOutline) {
                            ctx.lineWidth = layer.outlineWidth;
                            ctx.strokeStyle = layer.outlineColor;
                            ctx.strokeText(char, currentAdvance, lineY);
                        }
                    }

                    ctx.restore();

                    currentAdvance += charW + scaledLetterSpacing;
                });
            });

            // Restores happen automatically via outer ctx.restore() 
        }

        ctx.restore();
    };


    // 1. Special Effects
    if (layer.specialEffect === 'echo') {
        const echoCount = 5;
        const startOpacity = 1.0;
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        const distanceStep = layer.effectIntensity * (width * 0.0005); 

        // We render echoes on the scratch canvas. 
        // Note: Global alpha of the layer is applied later during composition.
        // Here we just control relative opacity of echoes.
        for (let i = echoCount; i > 0; i--) {
             const dx = Math.cos(angleRad) * distanceStep * i;
             const dy = Math.sin(angleRad) * distanceStep * i;
             ctx.globalAlpha = startOpacity * (0.1 + (0.5 * (1 - i/echoCount))); 
             drawTextItem(rawText, dx, dy, undefined, layer.isHollow);
        }
    }

    if (layer.specialEffect === 'glitch') {
        const offset = (layer.effectIntensity / 100) * (fontSize * 0.5);
        const angleRad = (layer.effectAngle * Math.PI) / 180;

        if (layer.isRainbowGlitch) {
             const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
             const spread = offset * 3.0; 
             
             ctx.save();
             ctx.globalCompositeOperation = 'source-over'; 

             const blurScale = width / 1000;
             const blurAmount = layer.rainbowBlur * blurScale;
             const OFFSET_HACK = 20000;

             colors.forEach((c, i) => {
                 const mid = Math.floor(colors.length / 2); 
                 const dist = (i - mid) * spread;
                 const dx = Math.cos(angleRad) * dist;
                 const dy = Math.sin(angleRad) * dist;
                 
                 const rgb = hexToRgb(c);
                 const rgbaColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layer.rainbowOpacity})`;
                 
                 if (blurAmount > 0) {
                     ctx.save();
                     ctx.shadowColor = rgbaColor;
                     ctx.shadowBlur = blurAmount;
                     ctx.shadowOffsetX = OFFSET_HACK;
                     ctx.shadowOffsetY = 0;
                     ctx.translate(-OFFSET_HACK, 0);
                     drawTextItem(rawText, dx, dy, '#000000', false, true);
                     ctx.restore();
                 } else {
                     drawTextItem(rawText, dx, dy, rgbaColor, false, true);
                 }
             });
             ctx.restore();
        } else {
            const c1 = layer.effectColor;
            const c2 = layer.effectColor2;
            
            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen'; 
            drawTextItem(rawText, -offset, 0, c1, false);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen';
            drawTextItem(rawText, offset, 0, c2, false); 
            ctx.restore();
        }
    }

    // 2. Main Text Pass
    ctx.save();
    ctx.globalAlpha = 1.0;
    // We are drawing onto a clean scratch canvas, so blend modes inside the text itself (like gradient) work.
    // The layer-wide blend mode is applied during composition.
    ctx.globalCompositeOperation = 'source-over';
    drawTextItem(rawText, 0, 0, undefined, undefined); 
    ctx.restore();
  };

  const renderToContext = useCallback((
      ctx: CanvasRenderingContext2D | null, 
      width: number, 
      height: number,
      isPreview: boolean = false,
      shouldClear: boolean = true,
      overrideBlendMode?: GlobalCompositeOperation,
      overrideBgImage?: HTMLImageElement
  ) => {
      if (!ctx) return;
      
      const bgImg = overrideBgImage || bgImageRef.current;
      const scratch = getScratchCanvas(width, height);
      const scratchCtx = scratch.getContext('2d');
      if (!scratchCtx) return;

      if (shouldClear) {
          if (bgImg) {
              ctx.clearRect(0, 0, width, height); 
              ctx.drawImage(bgImg, 0, 0, width, height);
          } else {
              ctx.clearRect(0, 0, width, height);
          }
      }

      // Render Pipeline:
      // 1. Render Layer to Offscreen Buffer (Scratch Canvas)
      // 2. Draw Offscreen Buffer to Main Canvas (with Shadow & Opacity)
      design.layers.forEach(layer => {
          if (!layer.visible) return;

          // A. CLEAR SCRATCH
          scratchCtx.clearRect(0, 0, width, height);
          
          // B. RENDER VISUALS TO SCRATCH
          // We pass isPreview to draw path lines if selected
          renderLayerVisuals(scratchCtx, layer, width, height, isPreview);

          // C. COMPOSITE TO MAIN
          ctx.save();
          // Reset Transform to Identity to ensure shadows are applied in Screen Space (Global)
          // This prevents rotation/scale from distorting the shadow vector.
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          // Apply Layer Blending
          const effectiveBlendMode = overrideBlendMode || (layer.blendMode === 'normal' ? 'source-over' : layer.blendMode);
          ctx.globalAlpha = layer.opacity;
          ctx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;

          // Apply Shadow
          if (layer.hasShadow) {
              // Calculate screen-space offsets based on global angle
              const angleRad = (layer.shadowAngle * Math.PI) / 180;
              const fontSize = (layer.textSize / 100) * width;
              // Normalize dist to be consistent with previous logic
              const dist = (layer.shadowOffset / 100) * fontSize;
              
              const sx = dist * Math.cos(angleRad);
              const sy = dist * Math.sin(angleRad);

              const sAlpha = (layer.shadowOpacity ?? 1);
              ctx.shadowColor = hexToRgba(layer.shadowColor, sAlpha);
              ctx.shadowBlur = (layer.shadowBlur / 100) * (fontSize * 2);
              ctx.shadowOffsetX = sx;
              ctx.shadowOffsetY = sy;
          }

          // Draw the rasterized layer onto the main canvas
          ctx.drawImage(scratch, 0, 0);
          
          ctx.restore();
      });

  }, [design.layers, interactionMode, design.activeLayerId]);

  // Live Preview Renderer
  useEffect(() => {
      if (textCanvasRef.current && imgDims) {
          const ctx = textCanvasRef.current.getContext('2d');
          textCanvasRef.current.width = imgDims.w;
          textCanvasRef.current.height = imgDims.h;
          renderToContext(ctx, imgDims.w, imgDims.h, true, true);
      }
  }, [imgDims, design, renderToContext]);


  // Export Logic
  const generateExport = useCallback(async (): Promise<string> => {
    if (!imageSrc) throw new Error("No image to export");
    await document.fonts.ready;

    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) throw new Error("Could not get canvas context");

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => { 
        img.onload = resolve; 
        img.onerror = reject;
        img.src = imageSrc; 
    });

    finalCanvas.width = img.naturalWidth;
    finalCanvas.height = img.naturalHeight;

    // Use the unified rendering pipeline.
    renderToContext(finalCtx, finalCanvas.width, finalCanvas.height, false, true, undefined, img);

    return finalCanvas.toDataURL('image/png');
  }, [imageSrc, renderToContext]);

  useImperativeHandle(ref, () => ({
    exportImage: generateExport,
    triggerFileUpload: () => fileInputRef.current?.click()
  }), [generateExport]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingFile(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingFile(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingFile(false);
    if (e.dataTransfer.files?.[0]?.type.startsWith('image/')) {
        onImageUpload(e.dataTransfer.files[0]);
    }
  };

  // Helper for sizing logic
  const getEmptyStateStyle = () => {
    if (imageSrc && imgDims) {
        return {
            aspectRatio: `${imgDims.w}/${imgDims.h}`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
            transformOrigin: 'center center'
        };
    }

    const [wStr, hStr] = design.aspectRatio.split(':');
    let w = parseFloat(wStr);
    let h = parseFloat(hStr);
    
    if (design.orientation === 'portrait') {
       const temp = w; w = h; h = temp;
    }
    
    const numericRatio = w / h;
    const isPortrait = design.orientation === 'portrait';
    const SHORT_EDGE_SIZE = '28rem'; 

    let calculatedWidthConstraint;
    if (isPortrait) {
        calculatedWidthConstraint = SHORT_EDGE_SIZE;
    } else {
        calculatedWidthConstraint = `calc(${SHORT_EDGE_SIZE} * ${numericRatio})`;
    }
    const heightBasedWidthConstraint = `calc(80vh * ${numericRatio})`;

    return {
        width: `min(90%, ${calculatedWidthConstraint}, ${heightBasedWidthConstraint})`,
        aspectRatio: `${numericRatio}`,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
        transformOrigin: 'center center'
    };
  };

  const getContainerClass = () => {
      if (imageSrc) {
          return 'w-auto h-auto max-w-full max-h-full';
      }
      return 'shadow-2xl'; 
  };
  
  // Cursor logic
  let cursorStyle = 'default';
  if (activeLayer?.isPathInputMode) cursorStyle = 'crosshair';
  else if (activeLayer?.isPathMoveMode) cursorStyle = 'move';
  else if (interactionMode === 'GIZMO_ROTATE') cursorStyle = 'grabbing';
  else if (interactionMode === 'GIZMO_SCALE') {
      if (activeGizmoHandle === 'tr' || activeGizmoHandle === 'bl') {
           cursorStyle = 'nesw-resize';
      } else {
           cursorStyle = 'nwse-resize';
      }
  }
  else if (interactionMode === 'GIZMO_MOVE') cursorStyle = 'move';
  else if (interactionMode === 'PAN') cursorStyle = 'grabbing';
  else if (imageSrc) cursorStyle = 'grab';

  // --- Dynamic Styling for Gizmo ---
  const invScale = 1 / zoomScale;
  const cornerSize = 8 * invScale;
  const cornerOffset = -4 * invScale;
  const boxBorderWidth = 1 * invScale;
  
  const rotHandleSize = 40 * invScale;
  const rotStemHeight = 32 * invScale;
  const rotHandleOffset = -rotStemHeight; 

  return (
    <>
    <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept="image/*"
        onChange={(e) => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]); }}
    />
    <div 
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: cursorStyle }}
    >
      <div 
        ref={containerRef}
        style={getEmptyStateStyle()}
        className={`
          relative flex items-center justify-center select-none transition-all duration-0 ease-linear
          ${getContainerClass()}
          ${className}
        `}
      >
        {imageSrc ? (
          <>
            <div className="relative w-full h-full overflow-hidden rounded-[3px] shadow-2xl bg-neutral-900 flex items-center justify-center">
                <img 
                  key={imageSrc} 
                  src={imageSrc} 
                  alt="Background" 
                  className="max-w-full max-h-full object-contain pointer-events-none opacity-0" 
                  width={imgDims?.w}
                  height={imgDims?.h}
                />
                
                <canvas 
                    ref={textCanvasRef}
                    className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-150 ${imgDims ? 'opacity-100' : 'opacity-0'}`}
                    style={{ 
                        mixBlendMode: (activeLayer?.isPathInputMode || activeLayer?.isPathMoveMode) ? 'normal' : 'normal' 
                    }}
                />
                
                {activeLayer?.isPathInputMode && activeLayer.pathPoints.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white text-xs flex items-center gap-2 border border-white/10 animate-pulse">
                            <PenTool size={12} />
                            <span>Draw path on image...</span>
                        </div>
                    </div>
                )}
                
                <div className="absolute inset-0 pointer-events-none opacity-10 border-neutral-500">
                    <div className="w-full h-1/2 border-b border-dashed border-white/30 absolute top-0"></div>
                    <div className="h-full w-1/2 border-r border-dashed border-white/30 absolute left-0"></div>
                </div>
            </div>

            {/* GIZMO OVERLAY (Outside Clipped Area) - Only for Active Layer */}
            {activeLayer && !activeLayer.isPathInputMode && activeLayer.pathPoints.length === 0 && imgDims && (
                <div
                    className="absolute pointer-events-none group z-50"
                    style={{
                        left: `${activeLayer.overlayPosition.x}%`,
                        top: `${activeLayer.overlayPosition.y}%`,
                        width: textBounds.width,
                        height: textBounds.height,
                        transform: `translate(-50%, -50%) rotate(${activeLayer.rotation}deg) scale(${activeLayer.flipX ? -1 : 1}, ${activeLayer.flipY ? -1 : 1})`,
                    }}
                >
                    {/* The Bounding Box - Interactive Area */}
                    <div 
                        data-handle="box"
                        className="absolute inset-0 border-white/60 border-dashed hover:border-pink-500/80 pointer-events-auto cursor-move"
                        style={{ borderWidth: `${boxBorderWidth}px` }}
                    ></div>

                    {/* Scale Handles (Corners) */}
                    {[
                        { id: 'tl', style: { top: `${cornerOffset}px`, left: `${cornerOffset}px` } },
                        { id: 'tr', style: { top: `${cornerOffset}px`, right: `${cornerOffset}px` } },
                        { id: 'bl', style: { bottom: `${cornerOffset}px`, left: `${cornerOffset}px` } },
                        { id: 'br', style: { bottom: `${cornerOffset}px`, right: `${cornerOffset}px` } }
                    ].map((h, i) => (
                        <div 
                            key={h.id}
                            data-handle={h.id}
                            style={{ 
                                ...h.style,
                                width: `${cornerSize}px`,
                                height: `${cornerSize}px`
                            }}
                            className={`absolute bg-white border border-pink-500 hover:bg-pink-500 pointer-events-auto ${
                                (i === 1 || i === 2) ? 'cursor-nesw-resize' : 'cursor-nwse-resize'
                            }`}
                        />
                    ))}

                    {/* Rotation Stem */}
                    <div 
                        className="absolute left-1/2 -translate-x-1/2 bg-pink-500/50" 
                        style={{
                            top: 0,
                            width: `${1 * invScale}px`,
                            height: `${rotStemHeight}px`,
                            transform: `translateY(-100%)`
                        }}
                    />

                    {/* Rotation Handle (Lollipop) */}
                    <div 
                        data-handle="rotate"
                        className="absolute left-1/2 bg-white/10 hover:bg-pink-500/20 border-white/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto cursor-grab shadow-lg transition-colors rounded-full"
                        style={{
                            width: `${rotHandleSize}px`,
                            height: `${rotHandleSize}px`,
                            top: `${rotHandleOffset}px`,
                            transform: `translate(-50%, -50%)`, // Center on top of stem
                            borderWidth: `${1 * invScale}px`
                        }}
                        title="Drag to Rotate"
                    >
                        <div 
                            className="bg-white rounded-full pointer-events-none" 
                            style={{ width: `${6 * invScale}px`, height: `${6 * invScale}px` }}
                        />
                        <RotateCw size={20 * invScale} className="text-white absolute opacity-0 hover:opacity-100 pointer-events-none transition-opacity" />
                    </div>

                    {/* Visual Anchor for Position */}
                    <div 
                        className="absolute top-1/2 left-1/2 bg-pink-500 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                        style={{ width: `${4 * invScale}px`, height: `${4 * invScale}px` }}
                    ></div>
                </div>
            )}
          </>
        ) : (
          <div 
              onClick={() => fileInputRef.current?.click()}
              className={`
                 relative shadow-2xl bg-zinc-100 w-full h-full 
                 cursor-pointer group transition-all duration-300 ease-out
                 ${isDraggingFile ? 'scale-105 rotate-1 bg-white ring-4 ring-pink-500/20' : 'hover:scale-[1.01] hover:-rotate-1 hover:bg-white'}
              `}
              style={{
                  padding: '16px 16px 80px 16px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
          >
             {/* Inner Dark "Film" Area */}
             <div className="w-full h-full bg-neutral-950 relative overflow-hidden flex flex-col items-center justify-center gap-4 border border-neutral-900 shadow-inner">
                
                {/* Subtle sheen */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

                <div className={`relative z-10 p-4 rounded-full bg-neutral-900 border border-neutral-800 shadow-xl transition-all duration-300 ${isDraggingFile ? 'scale-110 border-pink-500/50' : 'group-hover:border-neutral-700'}`}>
                   <Upload className={`w-8 h-8 transition-colors duration-300 ${isDraggingFile ? 'text-pink-500' : 'text-neutral-600 group-hover:text-neutral-400'}`} />
                </div>
                
                <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase group-hover:text-neutral-300 transition-colors">
                        {isDraggingFile ? 'Drop File' : 'Upload Image'}
                    </span>
                    <span className="text-[10px] text-neutral-700 font-medium opacity-50">
                        {isDraggingFile ? 'Release to add' : 'Click or Drag & Drop'}
                    </span>
                </div>
            </div>

            {/* Handwritten Label */}
            <div className="absolute bottom-0 left-0 right-0 h-20 flex items-center justify-center pointer-events-none">
                 <span 
                    className="text-neutral-800/70 text-xl transform -rotate-2 origin-center"
                    style={{ fontFamily: '"Permanent Marker", cursive' }}
                 >
                    {isDraggingFile ? 'drop here!' : (design.prompt ? 'visualize prompt' : 'add photo')}
                 </span>
            </div>
          </div>
        )}
      </div>

      {imageSrc && imgDims && (
        <div className="absolute bottom-4 right-4 z-50 bg-black/80 backdrop-blur text-neutral-300 text-[10px] font-medium px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-3 shadow-xl select-none pointer-events-none">
            <span className="flex items-center gap-1">
                <Maximize2 size={10} className="text-neutral-400" />
                {imgDims.w} × {imgDims.h}
            </span>
            <span className="w-px h-3 bg-white/10"></span>
            <span className="text-neutral-400">{design.aspectRatio}</span>
            <span className="w-px h-3 bg-white/10"></span>
            <span>{((imgDims.w * imgDims.h) / 1000000).toFixed(1)} MP</span>
        </div>
      )}
    </div>
    </>
  );
});

export default Canvas;
