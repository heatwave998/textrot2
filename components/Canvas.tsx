
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import { DesignState, Point } from '../types';
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

const measureTextLayout = (ctx: CanvasRenderingContext2D, design: DesignState, width: number) => {
    const fontSize = (design.textSize / 100) * width;
    ctx.font = `${design.isItalic ? 'italic' : 'normal'} ${design.isBold ? 'bold' : 'normal'} ${fontSize}px "${design.fontFamily}"`;
    
    const scaledLetterSpacing = design.letterSpacing * (fontSize / 50);
    const rawText = design.isUppercase ? design.textOverlay.toUpperCase() : design.textOverlay;
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

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState<{ w: number, h: number } | null>(null);
  
  // Interaction States
  const [interactionMode, setInteractionMode] = useState<'NONE' | 'PAN' | 'DRAW_PATH' | 'MOVE_PATH' | 'GIZMO_MOVE' | 'GIZMO_SCALE' | 'GIZMO_ROTATE'>('NONE');
  const [activeGizmoHandle, setActiveGizmoHandle] = useState<string | null>(null);

  // Refs for drag calculations
  const dragStartRef = useRef({ x: 0, y: 0 }); // Screen coordinates
  const initialDesignRef = useRef<DesignState | null>(null); // Snapshot of design at drag start
  const currentPathRef = useRef<Point[]>([]);
  
  // Metrics for Gizmo
  const [textBounds, setTextBounds] = useState({ width: 0, height: 0 });

  // Reset zoom and get dims when the image changes
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    setImgDims(null);

    if (imageSrc) {
        const i = new Image();
        i.onload = () => {
            setImgDims({ w: i.naturalWidth, h: i.naturalHeight });
        };
        i.onerror = () => {
            console.error("Failed to load image dimensions");
            setImgDims(null); 
        };
        i.src = imageSrc;
    } else {
        setImgDims(null);
    }
  }, [imageSrc]);

  // Update Text Bounds when design changes
  useEffect(() => {
      if (textCanvasRef.current && imgDims) {
          const ctx = textCanvasRef.current.getContext('2d');
          if (ctx) {
              const metrics = measureTextLayout(ctx, design, imgDims.w);
              setTextBounds(metrics);
          }
      }
  }, [design, imgDims]);

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom || !imageSrc) return;
    const scaleAmount = -e.deltaY * 0.001; 
    const newScale = Math.min(Math.max(0.1, zoomScale + scaleAmount), 5); 
    setZoomScale(newScale);
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

      if (handleType) {
          e.preventDefault();
          e.stopPropagation();
          initialDesignRef.current = { ...design };
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
      if (design.isPathInputMode) {
          e.preventDefault();
          setInteractionMode('DRAW_PATH');
          currentPathRef.current = [coords];
          return;
      }

      if (design.isPathMoveMode && design.pathPoints.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setInteractionMode('MOVE_PATH');
          initialDesignRef.current = { ...design }; // Store points snapshot
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
           if (!coords || !initialDesignRef.current) return;
           e.preventDefault();
           
           const dx = coords.x - dragStartRef.current.x;
           const dy = coords.y - dragStartRef.current.y;
           
           const newPoints = initialDesignRef.current.pathPoints.map(p => ({
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
          if (!initialDesignRef.current) return;

          const startDesign = initialDesignRef.current;
          
          if (interactionMode === 'GIZMO_MOVE') {
               // Calculate delta in intrinsic pixels
               const rect = containerRef.current!.getBoundingClientRect();
               // Factor in zoom: The container rect *is* scaled. 
               // 1 screen pixel = (imgDims.w / rect.width) intrinsic pixels.
               const scaleFactor = imgDims.w / rect.width;
               
               const dxScreen = e.clientX - dragStartRef.current.x;
               const dyScreen = e.clientY - dragStartRef.current.y;
               
               const dxIntrinsic = dxScreen * scaleFactor;
               const dyIntrinsic = dyScreen * scaleFactor;
               
               // Convert intrinsic delta to percentage
               const dxPercent = (dxIntrinsic / imgDims.w) * 100;
               const dyPercent = (dyIntrinsic / imgDims.h) * 100;

               onUpdateDesign({
                   overlayPosition: {
                       x: Math.max(0, Math.min(100, startDesign.overlayPosition.x + dxPercent)),
                       y: Math.max(0, Math.min(100, startDesign.overlayPosition.y + dyPercent))
                   }
               });
          }

          if (interactionMode === 'GIZMO_SCALE') {
               const rect = containerRef.current!.getBoundingClientRect();
               // Center of the text in screen coordinates
               const cx = rect.left + (startDesign.overlayPosition.x / 100) * rect.width;
               const cy = rect.top + (startDesign.overlayPosition.y / 100) * rect.height;
               
               // Distances
               const startDist = Math.hypot(dragStartRef.current.x - cx, dragStartRef.current.y - cy);
               const currDist = Math.hypot(e.clientX - cx, e.clientY - cy);
               
               const ratio = currDist / (startDist || 1);
               // Removed rounding for fluid resize
               const newSize = Math.min(50, Math.max(0.1, startDesign.textSize * ratio));
               
               onUpdateDesign({ textSize: newSize });
          }

          if (interactionMode === 'GIZMO_ROTATE') {
               const rect = containerRef.current!.getBoundingClientRect();
               const cx = rect.left + (startDesign.overlayPosition.x / 100) * rect.width;
               const cy = rect.top + (startDesign.overlayPosition.y / 100) * rect.height;
               
               // Rotation logic: Measure angle relative to center
               // We add 90 degrees because atan2(0, -1) (top) is -90 deg, but our 0 deg is right.
               // Actually, let's just use the delta angle from start, but absolute angle is more robust.
               const angleRad = Math.atan2(e.clientY - cy, e.clientX - cx);
               let angleDeg = angleRad * (180 / Math.PI) + 90; // Align 0 to top?
               
               // Standard CSS rotation: 0 is Up? No, 0 is usually Right for math, but for CSS 'rotate(0deg)' depends.
               // Let's assume standard behavior: moving mouse right from top = clockwise.
               
               // Normalize
               if (angleDeg < 0) angleDeg += 360;
               
               // Snap to 15 deg
               if (e.shiftKey) {
                   angleDeg = Math.round(angleDeg / 15) * 15;
               }

               onUpdateDesign({ rotation: Math.round(angleDeg) });
          }
      }
  };

  const handleMouseUp = () => {
      if (interactionMode === 'DRAW_PATH') {
          onPathDrawn(currentPathRef.current);
          currentPathRef.current = [];
      }
      setInteractionMode('NONE');
      setActiveGizmoHandle(null);
      initialDesignRef.current = null;
  };


  // --- Core Rendering Logic ---
  const renderToContext = useCallback((
      ctx: CanvasRenderingContext2D | null, 
      width: number, 
      height: number,
      isPreview: boolean = false,
      shouldClear: boolean = true,
      overrideBlendMode?: GlobalCompositeOperation
  ) => {
    if (!ctx) return;

    if (shouldClear) {
        ctx.clearRect(0, 0, width, height);
    }
    
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    const effectiveBlendMode = overrideBlendMode || (isPreview ? 'source-over' : (design.blendMode === 'normal' ? 'source-over' : design.blendMode));

    const activePointsRaw = interactionMode === 'DRAW_PATH' ? currentPathRef.current : design.pathPoints;
    const activePoints = interactionMode === 'DRAW_PATH' ? activePointsRaw : getSmoothedPoints(activePointsRaw, design.pathSmoothing);

    const showPathLine = isPreview && (
        (interactionMode === 'DRAW_PATH' && activePoints.length > 1) ||
        (design.isPathMoveMode && activePoints.length > 1)
    );

    if (showPathLine) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#ec4899'; 
        ctx.lineWidth = Math.max(2, width * 0.003); 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (design.isPathMoveMode && interactionMode !== 'DRAW_PATH') {
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

    const fontSize = (design.textSize / 100) * width;
    const fontWeight = design.isBold ? 'bold' : 'normal';
    const fontStyle = design.isItalic ? 'italic' : 'normal';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${design.fontFamily}"`;
    ctx.textAlign = 'left'; // Always calculate from left for manual ink alignment
    ctx.textBaseline = 'middle';

    const scaledLetterSpacing = design.letterSpacing * (fontSize / 50); 
    const rawText = design.isUppercase ? design.textOverlay.toUpperCase() : design.textOverlay;
    const lines = rawText.split('\n');
    const lineHeight = fontSize * 1.0; // Tight line height matching font size
    const totalHeight = lines.length * lineHeight;

    // Recalculate Max Ink Width for Alignment Context
    let maxInkWidth = 0;
    const lineMetrics = lines.map(line => {
        const m = measureLineMetrics(ctx, line, scaledLetterSpacing);
        if (m.inkWidth > maxInkWidth) maxInkWidth = m.inkWidth;
        return m;
    });

    let normalModeFillStyle: string | CanvasGradient = design.textColor;
    
    if (design.specialEffect === 'gradient' && !design.isHollow) {
        const r = Math.sqrt((maxInkWidth/2)**2 + (totalHeight/2)**2);
        const angleRad = (design.effectAngle * Math.PI) / 180;
        const x1 = -Math.cos(angleRad) * r;
        const y1 = -Math.sin(angleRad) * r;
        const x2 = Math.cos(angleRad) * r;
        const y2 = Math.sin(angleRad) * r;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        const halfSpread = design.effectIntensity / 2; 
        const stop1 = Math.max(0, Math.min(1, (50 - halfSpread) / 100));
        const stop2 = Math.max(0, Math.min(1, (50 + halfSpread) / 100));

        grad.addColorStop(stop1, design.textColor);
        grad.addColorStop(stop2, design.effectColor);
        normalModeFillStyle = grad;
    }

    const drawTextItem = (text: string, offsetX: number, offsetY: number, colorOverride?: string, forceHollow?: boolean, disableOutline: boolean = false) => {
        const isHollow = forceHollow !== undefined ? forceHollow : design.isHollow;
        const shouldDrawOutline = !disableOutline && design.hasOutline;

        ctx.save();

        if (activePoints && activePoints.length > 1) {
            // Path Drawing Logic
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
            if (design.textAlign === 'center') currentDist = (totalPathLen - totalTextWidth) / 2;
            if (design.textAlign === 'right') currentDist = totalPathLen - totalTextWidth;
            
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
                    
                    // Apply Letter Rotation to the angle
                    const letterRotRad = (design.letterRotation * Math.PI) / 180;

                    ctx.translate(xFinal, yFinal);
                    ctx.rotate(angle + letterRotRad);
                    
                    let activeFill = colorOverride || design.textColor;
                    if (!colorOverride && design.specialEffect === 'gradient' && !isHollow) {
                        const gradT = Math.max(0, Math.min(1, charMidDist / totalPathLen));
                        activeFill = interpolateColor(design.textColor, design.effectColor, gradT);
                    }

                    if (isHollow) {
                         ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2; 
                         ctx.strokeStyle = colorOverride || (design.hasOutline ? design.outlineColor : design.textColor);
                         ctx.strokeText(char, 0, 0);
                    } else {
                         ctx.fillStyle = activeFill;
                         ctx.fillText(char, 0, 0);
                         
                         if (shouldDrawOutline) {
                             ctx.lineWidth = design.outlineWidth;
                             ctx.strokeStyle = design.outlineColor;
                             ctx.strokeText(char, 0, 0);
                         }
                    }

                    ctx.rotate(-(angle + letterRotRad));
                    ctx.translate(-xFinal, -yFinal);
                }
                currentDist += charWidth + scaledLetterSpacing;
            }

        } else {
            const xPos = (design.overlayPosition.x / 100) * width;
            const yPos = (design.overlayPosition.y / 100) * height;
            
            ctx.translate(xPos, yPos);
            
            if (design.rotation !== 0) ctx.rotate((design.rotation * Math.PI) / 180);
            const sX = design.flipX ? -1 : 1;
            const sY = design.flipY ? -1 : 1;
            if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);

            const startY = -(totalHeight / 2) + (lineHeight / 2);

            lines.forEach((line, i) => {
                const lineY = startY + (i * lineHeight) + offsetY;
                const m = lineMetrics[i];
                const chars = line.split('');
                
                // Alignment Calculation based on Ink Bounds vs Max Ink Bounds of block
                let startX = 0;
                
                if (design.textAlign === 'left') {
                    // Align Ink Left to Box Left
                    startX = -(maxInkWidth / 2) - m.inkLeft;
                } else if (design.textAlign === 'right') {
                    // Align Ink Right to Box Right
                    startX = (maxInkWidth / 2) - m.inkRight;
                } else {
                    // Center Ink
                    const inkCenter = (m.inkLeft + m.inkRight) / 2;
                    startX = -inkCenter;
                }
                
                // Drawing loop using advance widths
                let currentAdvance = startX + offsetX;
                chars.forEach((char, idx) => {
                    const charW = ctx.measureText(char).width;
                    
                    // Letter Rotation Logic (Normal Mode)
                    const isRotated = design.letterRotation !== 0;
                    if (isRotated) {
                        const centerX = currentAdvance + charW / 2;
                        const centerY = lineY; // textBaseline is middle
                        ctx.save();
                        ctx.translate(centerX, centerY);
                        ctx.rotate((design.letterRotation * Math.PI) / 180);
                        ctx.translate(-centerX, -centerY);
                    }

                    if (isHollow) {
                        ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2; 
                        ctx.strokeStyle = colorOverride || (design.hasOutline ? design.outlineColor : design.textColor);
                        ctx.strokeText(char, currentAdvance, lineY);
                    } else {
                        ctx.fillStyle = colorOverride || normalModeFillStyle;
                        ctx.fillText(char, currentAdvance, lineY);
                        
                        if (shouldDrawOutline) {
                            ctx.lineWidth = design.outlineWidth;
                            ctx.strokeStyle = design.outlineColor;
                            ctx.strokeText(char, currentAdvance, lineY);
                        }
                    }

                    if (isRotated) {
                        ctx.restore();
                    }

                    currentAdvance += charW + scaledLetterSpacing;
                });
            });

            if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);
            if (design.rotation !== 0) ctx.rotate(-(design.rotation * Math.PI) / 180);
            ctx.translate(-xPos, -yPos);
        }

        ctx.restore();
    };


    // 1. Shadow Pass
    if (design.hasShadow) {
        ctx.save();
        ctx.globalAlpha = design.opacity; 
        ctx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;
        ctx.shadowColor = design.shadowColor;
        ctx.shadowBlur = (design.shadowBlur / 100) * (fontSize * 2);
        
        const shadowRad = (design.shadowAngle * Math.PI) / 180;
        const shadowDist = (design.shadowOffset / 100) * fontSize;
        const sx = Math.cos(shadowRad) * shadowDist;
        const sy = Math.sin(shadowRad) * shadowDist;
        
        const OFFSET_HACK = 20000;
        ctx.translate(-OFFSET_HACK, 0);
        ctx.shadowOffsetX = sx + OFFSET_HACK;
        ctx.shadowOffsetY = sy;
        
        drawTextItem(rawText, 0, 0, design.isHollow ? undefined : design.textColor, design.isHollow);
        ctx.restore();
    }

    // 2. Special Effects
    if (design.specialEffect === 'echo') {
        const echoCount = 5;
        const startOpacity = design.opacity;
        const angleRad = (design.effectAngle * Math.PI) / 180;
        const distanceStep = design.effectIntensity * (width * 0.0005); 

        ctx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;
        for (let i = echoCount; i > 0; i--) {
             const dx = Math.cos(angleRad) * distanceStep * i;
             const dy = Math.sin(angleRad) * distanceStep * i;
             ctx.globalAlpha = startOpacity * (0.1 + (0.5 * (1 - i/echoCount))); 
             drawTextItem(rawText, dx, dy, undefined, design.isHollow);
        }
    }

    if (design.specialEffect === 'glitch') {
        const offset = (design.effectIntensity / 100) * (fontSize * 0.5);
        const angleRad = (design.effectAngle * Math.PI) / 180;

        if (design.isRainbowGlitch) {
             const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
             const spread = offset * 3.0; // Extended offset range by 2.5x
             
             ctx.save();
             // Do NOT use globalAlpha with filter, as it can be ignored or behave inconsistently.
             // Instead, we bake opacity into the fillStyle color.
             ctx.globalCompositeOperation = 'source-over'; 

             // Fix for blur: Use context filter + scale by resolution
             // This ensures 10 units of blur looks consistent on 500px preview and 2000px export
             const blurScale = width / 1000;
             const blurAmount = design.rainbowBlur * blurScale;

             // Apply Blur GLOBALLY for the rainbow block to ensure consistent rendering context state
             // and better performance than toggling it per-layer.
             if (blurAmount > 0) {
                 ctx.filter = `blur(${blurAmount}px)`;
             }

             colors.forEach((c, i) => {
                 const mid = Math.floor(colors.length / 2); 
                 const dist = (i - mid) * spread;
                 const dx = Math.cos(angleRad) * dist;
                 const dy = Math.sin(angleRad) * dist;
                 
                 const rgb = hexToRgb(c);
                 const rgbaColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${design.rainbowOpacity})`;
                 
                 // Draw the text with color override 'rgbaColor', forcing solid (forceHollow=false), disable outline for clean rainbow
                 drawTextItem(rawText, dx, dy, rgbaColor, false, true);
             });
             
             ctx.restore();
        } else {
            const c1 = design.effectColor;
            const c2 = design.effectColor2;
            
            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen'; 
            ctx.shadowColor = c1;
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            drawTextItem(rawText, -offset, 0, c1, false);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen';
            ctx.shadowColor = c2;
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            drawTextItem(rawText, offset, 0, c2, false); 
            ctx.restore();
        }
    }

    // 3. Main Text Pass
    ctx.save();
    ctx.globalAlpha = design.opacity;
    ctx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;
    drawTextItem(rawText, 0, 0, undefined, undefined); 
    ctx.restore();

  }, [design, interactionMode]);

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

    // 1. Draw Background Image
    finalCtx.drawImage(img, 0, 0);

    // 2. Create Overlay Canvas (Text & Effects)
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = finalCanvas.width;
    overlayCanvas.height = finalCanvas.height;
    const overlayCtx = overlayCanvas.getContext('2d');

    // 3. Render Text Layer to Overlay
    // We use isPreview=false to disable guide lines.
    // We use shouldClear=true to ensure transparent background.
    // We force 'source-over' so shadows and text composite together into a single layer, just like they do on the transparent DOM canvas.
    renderToContext(overlayCtx, finalCanvas.width, finalCanvas.height, false, true, 'source-over');

    // 4. Composite Overlay onto Background with Blend Mode
    finalCtx.save();
    finalCtx.globalAlpha = 1.0; // Opacity is already handled in renderToContext
    finalCtx.globalCompositeOperation = design.blendMode === 'normal' ? 'source-over' : design.blendMode as GlobalCompositeOperation;
    finalCtx.drawImage(overlayCanvas, 0, 0);
    finalCtx.restore();

    return finalCanvas.toDataURL('image/png');
  }, [imageSrc, renderToContext, design.blendMode]);

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

    // Empty State Sizing Logic
    const [wStr, hStr] = design.aspectRatio.split(':');
    let w = parseFloat(wStr);
    let h = parseFloat(hStr);
    
    // Normalize ratio logic
    // The inputs are always "Landscape" ratios (Width >= Height) e.g. 16:9
    // If Portrait is selected, we swap them to 9:16.
    if (design.orientation === 'portrait') {
       const temp = w; w = h; h = temp;
    }
    
    const numericRatio = w / h;
    const isPortrait = design.orientation === 'portrait';
    
    // THE GOLDEN RULE: The "Short Edge" of the Polaroid frame is fixed to 28rem (~448px).
    // This ensures parity between Portrait and Landscape modes (just flipped dimensions).
    const SHORT_EDGE_SIZE = '28rem'; 

    let calculatedWidthConstraint;

    if (isPortrait) {
        // Portrait: Width is the short edge.
        calculatedWidthConstraint = SHORT_EDGE_SIZE;
    } else {
        // Landscape: Height is the short edge.
        // Since AspectRatio = Width / Height => Width = Height * Ratio
        calculatedWidthConstraint = `calc(${SHORT_EDGE_SIZE} * ${numericRatio})`;
    }

    // Viewport Height Constraint:
    // We also don't want the frame to exceed 80% of the screen height.
    // Width = Height * Ratio => MaxWidth = MaxHeight * Ratio
    const heightBasedWidthConstraint = `calc(80vh * ${numericRatio})`;

    return {
        // Apply the tightest constraint
        width: `min(90%, ${calculatedWidthConstraint}, ${heightBasedWidthConstraint})`,
        aspectRatio: `${numericRatio}`,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
        transformOrigin: 'center center'
    };
  };

  const getContainerClass = () => {
      // 1. Image Loaded State: Let image define intrinsic size, constrained by parent
      if (imageSrc) {
          return 'w-auto h-auto max-w-full max-h-full';
      }
      return 'shadow-2xl'; // Just visual classes
  };
  
  // Cursor logic
  let cursorStyle = 'default';
  if (design.isPathInputMode) cursorStyle = 'crosshair';
  else if (design.isPathMoveMode) cursorStyle = 'move';
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
  // Calculates inverse scale to keep handles constant visual size regardless of zoom
  const invScale = 1 / zoomScale;
  const cornerSize = 8 * invScale;
  const cornerOffset = -4 * invScale;
  const boxBorderWidth = 1 * invScale;
  
  const rotHandleSize = 40 * invScale;
  const rotStemHeight = 32 * invScale;
  // Offset to make the lollipop stem connect from bounding box (0) to handle bottom (-32)
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
            {/* Inner Wrapper for Visuals (Clipped) */}
            <div className="relative w-full h-full overflow-hidden rounded-[3px] shadow-2xl bg-neutral-900 flex items-center justify-center">
                <img 
                  key={imageSrc} 
                  src={imageSrc} 
                  alt="Background" 
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  width={imgDims?.w}
                  height={imgDims?.h}
                />
                
                <canvas 
                    ref={textCanvasRef}
                    className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-150 ${imgDims ? 'opacity-100' : 'opacity-0'}`}
                    style={{ 
                        mixBlendMode: (design.isPathInputMode || design.isPathMoveMode) ? 'normal' : design.blendMode as any 
                    }}
                />
                
                {design.isPathInputMode && design.pathPoints.length === 0 && (
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

            {/* GIZMO OVERLAY (Outside Clipped Area) */}
            {!design.isPathInputMode && design.pathPoints.length === 0 && imgDims && (
                <div
                    className="absolute pointer-events-none group z-50"
                    style={{
                        left: `${design.overlayPosition.x}%`,
                        top: `${design.overlayPosition.y}%`,
                        width: textBounds.width,
                        height: textBounds.height,
                        transform: `translate(-50%, -50%) rotate(${design.rotation}deg) scale(${design.flipX ? -1 : 1}, ${design.flipY ? -1 : 1})`,
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
