
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, useCallback, useLayoutEffect } from 'react';
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
  onLayerDoubleClicked?: (layerId: string) => void;
}

export interface CanvasHandle {
  exportImage: () => Promise<string>;
  triggerFileUpload: () => void;
  stampLayers: (layerIds: string[]) => Promise<string>;
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

// Helper: Get Bounds of a Path
const getPathBounds = (points: Point[]) => {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2
    };
};

/**
 * Constructs a CSS font string compatible with Canvas 2D Context.
 * Maps variable axes (wght, wdth, slnt) to standard CSS descriptors.
 */
const constructCanvasFont = (layer: TextLayer, width: number): string => {
    const fontSize = (layer.textSize / 100) * width;
    const fontFamily = `"${layer.fontFamily}"`; // Quote family to handle spaces safely
    
    // 1. Weight (wght)
    let weight = layer.isBold ? 700 : 400;
    if (layer.fontVariations && layer.fontVariations['wght'] !== undefined) {
        weight = Math.round(layer.fontVariations['wght']);
    }

    // 2. Width/Stretch (wdth)
    let stretch = "normal";
    if (layer.fontVariations && layer.fontVariations['wdth'] !== undefined) {
        const wVal = layer.fontVariations['wdth'];
        if (wVal !== 100) {
            stretch = `${Math.round(wVal)}%`;
        }
    }

    // 3. Style/Slant (slnt/ital)
    let style = layer.isItalic ? 'italic' : 'normal';
    if (layer.fontVariations && layer.fontVariations['slnt'] !== undefined) {
        const slnt = layer.fontVariations['slnt'];
        if (slnt !== 0) {
             style = `oblique ${Math.abs(slnt)}deg`;
        }
    }

    // Syntax: [style] [variant] [weight] [stretch] [size]/[line-height] [family]
    return `${style} normal ${weight} ${stretch} ${fontSize}px/1 ${fontFamily}`;
};

/**
 * Constructs the CSS font-variation-settings string.
 */
const getFontVariationSettings = (layer: TextLayer): string => {
    if (!layer.fontVariations || Object.keys(layer.fontVariations).length === 0) {
        return 'normal';
    }
    return Object.entries(layer.fontVariations)
        .map(([key, val]) => `"${key}" ${val}`)
        .join(', ');
};

/**
 * Creates an SVG Data URL containing the text rendered with full CSS capabilities.
 * This is used for EXPORTING to Canvas.
 */
const createTextSVG = (layer: TextLayer, width: number, height: number): string => {
    const fontSizePx = (layer.textSize / 100) * width;
    // Note: We avoid the 'font' shorthand here to prevent resetting font-variation-settings
    // const fontString = constructCanvasFont(layer, width); 
    
    const fontFamily = `"${layer.fontFamily}"`;
    const fontWeight = layer.fontVariations && layer.fontVariations['wght'] !== undefined 
        ? Math.round(layer.fontVariations['wght']) 
        : (layer.isBold ? 700 : 400);
        
    let fontStyle = layer.isItalic ? 'italic' : 'normal';
    if (layer.fontVariations && layer.fontVariations['slnt'] !== undefined && layer.fontVariations['slnt'] !== 0) {
         fontStyle = `oblique ${Math.abs(layer.fontVariations['slnt'])}deg`;
    }

    const variationSettings = getFontVariationSettings(layer);
    
    const text = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
    
    // Split lines for consistent rendering
    const lines = text.split('\n');
    
    // Generate HTML content EXACTLY like renderTextLayersOverlay
    const generateHtmlContent = () => {
        return lines.map(line => {
            const charSpans = line.split('').map(char => {
                const charDisplay = char === ' ' ? '&nbsp;' : char;
                const transform = layer.letterRotation !== 0 ? `transform: rotate(${layer.letterRotation}deg); display: inline-block;` : 'display: inline-block;';
                return `<span style="${transform}">${charDisplay}</span>`;
            }).join('');
            return `<div style="white-space: pre; display: block;">${charSpans}</div>`;
        }).join('');
    };

    const xPct = layer.overlayPosition.x;
    const yPct = layer.overlayPosition.y;

    // Shadow Math
    const angleRad = (layer.shadowAngle * Math.PI) / 180;
    const shadowDist = (layer.shadowOffset / 100) * fontSizePx;
    const sX = shadowDist * Math.cos(angleRad);
    const sY = shadowDist * Math.sin(angleRad);
    const sBlur = (layer.shadowBlur / 100) * fontSizePx * 2;
    const sColor = hexToRgba(layer.shadowColor, layer.shadowOpacity ?? 1);
    const shadowStyle = layer.hasShadow ? `${sX}px ${sY}px ${sBlur}px ${sColor}` : 'none';

    // Effects
    const webkitTextStroke = layer.hasOutline ? `${layer.outlineWidth}px ${layer.outlineColor}` : 
                             (layer.isHollow ? `2px ${layer.textColor}` : 'none');
    const colorStyle = layer.isHollow ? 'transparent' : layer.textColor;

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="
                width: 100%;
                height: 100%;
                position: relative;
                overflow: visible;
                background: transparent;
                font-synthesis: none;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            ">
                <div style="
                    position: absolute;
                    left: ${xPct}%;
                    top: ${yPct}%;
                    transform: translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1});
                    transform-origin: center center;
                    display: flex;
                    flex-direction: column;
                    align-items: ${layer.textAlign === 'center' ? 'center' : layer.textAlign === 'right' ? 'flex-end' : 'flex-start'};
                    text-align: ${layer.textAlign};
                    font-family: ${fontFamily};
                    font-size: ${fontSizePx}px;
                    font-weight: ${fontWeight};
                    font-style: ${fontStyle};
                    font-variation-settings: ${variationSettings};
                    color: ${colorStyle};
                    line-height: 1;
                    letter-spacing: ${layer.letterSpacing * (fontSizePx/50)}px;
                    white-space: pre;
                    text-shadow: ${shadowStyle};
                    -webkit-text-stroke: ${webkitTextStroke};
                ">
                    ${generateHtmlContent()}
                </div>
            </div>
        </foreignObject>
    </svg>
    `;
    
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};


// Helper: Get text metrics (Tight Ink Bounds)
const measureLineMetrics = (ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) => {
    const chars = text.split('');
    let currentX = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    
    if (chars.length === 0) return { inkLeft: 0, inkRight: 0, inkWidth: 0, advanceWidth: 0 };

    chars.forEach((char, i) => {
        const metrics = ctx.measureText(char);
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
    ctx.font = constructCanvasFont(layer, width);
    
    const scaledLetterSpacing = layer.letterSpacing * (fontSize / 50);
    const rawText = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
    const lines = rawText.split('\n');
    const lineHeight = fontSize * 1.0; 
    const totalHeight = lines.length * lineHeight;

    let maxInkWidth = 0;

    lines.forEach(line => {
        const metrics = measureLineMetrics(ctx, line, scaledLetterSpacing);
        if (metrics.inkWidth > maxInkWidth) maxInkWidth = metrics.inkWidth;
    });

    const buffer = fontSize * 0.5; // Generous buffer for gizmo
    return { width: maxInkWidth + buffer, height: totalHeight + (buffer * 0.5) };
};

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ imageSrc, design, enableZoom, className, onImageUpload, onPathDrawn, onUpdateDesign, onLayerDoubleClicked }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null); // Full-size buffer for compositing
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null); // Per-layer scratch
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState<{ w: number, h: number } | null>(null);
  
  const [interactionMode, setInteractionMode] = useState<'NONE' | 'PAN' | 'DRAW_PATH' | 'MOVE_PATH' | 'GIZMO_MOVE' | 'GIZMO_SCALE' | 'GIZMO_ROTATE'>('NONE');
  const [activeGizmoHandle, setActiveGizmoHandle] = useState<string | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialLayersRef = useRef<Map<string, TextLayer>>(new Map());
  const currentPathRef = useRef<Point[]>([]);
  
  const [textBounds, setTextBounds] = useState<Record<string, { width: number, height: number }>>({});
  const [visualScale, setVisualScale] = useState(1);

  const activeLayer = design.layers.find(l => l.id === design.activeLayerId);

  // Use Layout Effect to prevent visual jumps on load
  useLayoutEffect(() => {
     if (containerRef.current && imgDims) {
         if (containerRef.current.offsetWidth > 0 && imgDims.w > 0) {
            setVisualScale(containerRef.current.offsetWidth / imgDims.w);
         }
         const observer = new ResizeObserver(() => {
              if (containerRef.current && imgDims.w > 0) {
                 setVisualScale(containerRef.current.offsetWidth / imgDims.w);
              }
         });
         observer.observe(containerRef.current);
         return () => observer.disconnect();
     }
  }, [imgDims]);

  const getBufferCanvas = (width: number, height: number) => {
      if (!bufferCanvasRef.current) {
          bufferCanvasRef.current = document.createElement('canvas');
      }
      const canvas = bufferCanvasRef.current;
      if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
      }
      return canvas;
  };

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
            bgImageRef.current = null;
            setImgDims(null); 
        };
        i.src = imageSrc;
    } else {
        bgImageRef.current = null;
        setImgDims(null);
    }
  }, [imageSrc]);

  useEffect(() => {
      if (textCanvasRef.current && imgDims && design.selectedLayerIds.length > 0) {
          const ctx = textCanvasRef.current.getContext('2d');
          if (ctx) {
              const newBounds: Record<string, { width: number, height: number }> = {};
              design.selectedLayerIds.forEach(id => {
                  const layer = design.layers.find(l => l.id === id);
                  if (layer) {
                      newBounds[id] = measureTextLayout(ctx, layer, imgDims.w);
                  }
              });
              setTextBounds(newBounds);
          }
      }
  }, [design.layers, design.selectedLayerIds, imgDims]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom || !imageSrc) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    const scaleAmount = -e.deltaY * 0.001; 
    const nextScale = Math.min(Math.max(0.1, zoomScale + scaleAmount), 5); 
    if (nextScale !== zoomScale) {
        const scaleRatio = nextScale / zoomScale;
        const newPanX = mouseX - (mouseX - pan.x) * scaleRatio;
        const newPanY = mouseY - (mouseY - pan.y) * scaleRatio;
        setPan({ x: newPanX, y: newPanY });
        setZoomScale(nextScale);
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
      if (imageSrc) {
          setZoomScale(1);
          setPan({ x: 0, y: 0 });
      }
  };

  const getIntrinsicCoordinates = (e: React.MouseEvent) => {
      if (!containerRef.current || !imgDims) return null;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      return { x: relX * imgDims.w, y: relY * imgDims.h };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!imageSrc || !imgDims) return;
      const coords = getIntrinsicCoordinates(e);
      if (!coords) return;

      const target = e.target as HTMLElement;
      const handleEl = target.closest('[data-handle]');
      const handleType = handleEl?.getAttribute('data-handle');

      if (handleType && activeLayer) {
          e.preventDefault();
          e.stopPropagation();
          const snapshotMap = new Map<string, TextLayer>();
          design.layers.forEach(l => {
              if (design.selectedLayerIds.includes(l.id)) {
                  const cloned = { ...l };
                  if (cloned.pathPoints) cloned.pathPoints = [...l.pathPoints];
                  snapshotMap.set(l.id, cloned);
              }
          });
          initialLayersRef.current = snapshotMap;
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

      if (activeLayer?.isPathInputMode) {
          e.preventDefault();
          setInteractionMode('DRAW_PATH');
          currentPathRef.current = [coords];
          return;
      }

      if (enableZoom && e.button === 0) {
          setInteractionMode('PAN');
          dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
          e.preventDefault();
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const coords = getIntrinsicCoordinates(e);
      if (!imgDims) return;

      if (interactionMode === 'DRAW_PATH') {
          if (!coords) return;
          currentPathRef.current.push(coords);
          // Force render to update path line
          renderToContext(textCanvasRef.current?.getContext('2d') || null, imgDims.w, imgDims.h, design.layers, true, true, undefined, undefined, true);
          return;
      }

      if (interactionMode === 'PAN') {
          e.preventDefault();
          setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
          return;
      }

      if (['GIZMO_MOVE', 'GIZMO_SCALE', 'GIZMO_ROTATE'].includes(interactionMode)) {
          e.preventDefault();
          
          const primaryStartLayer = activeLayer ? initialLayersRef.current.get(activeLayer.id) : null;
          if (!primaryStartLayer) return;

          const rect = containerRef.current!.getBoundingClientRect();
          const scaleFactor = imgDims.w / rect.width;

          if (activeLayer?.isPathMoveMode && primaryStartLayer.pathPoints.length > 0) {
               const points = primaryStartLayer.pathPoints;
               const bounds = getPathBounds(points);
               const cx = bounds.cx;
               const cy = bounds.cy;
               
               let newPoints = [...points];

               if (interactionMode === 'GIZMO_MOVE') {
                   const dxScreen = e.clientX - dragStartRef.current.x;
                   const dyScreen = e.clientY - dragStartRef.current.y;
                   const dx = dxScreen * scaleFactor;
                   const dy = dyScreen * scaleFactor;
                   newPoints = points.map(p => ({ x: p.x + dx, y: p.y + dy }));
               } 
               else if (interactionMode === 'GIZMO_SCALE') {
                   const screenCx = rect.left + (cx / imgDims.w) * rect.width;
                   const screenCy = rect.top + (cy / imgDims.h) * rect.height;
                   const startDist = Math.hypot(dragStartRef.current.x - screenCx, dragStartRef.current.y - screenCy);
                   const currDist = Math.hypot(e.clientX - screenCx, e.clientY - screenCy);
                   const ratio = currDist / (startDist || 1);

                   newPoints = points.map(p => ({
                       x: cx + (p.x - cx) * ratio,
                       y: cy + (p.y - cy) * ratio
                   }));
               }
               else if (interactionMode === 'GIZMO_ROTATE') {
                   const screenCx = rect.left + (cx / imgDims.w) * rect.width;
                   const screenCy = rect.top + (cy / imgDims.h) * rect.height;
                   const startAngle = Math.atan2(dragStartRef.current.y - screenCy, dragStartRef.current.x - screenCx);
                   const currAngle = Math.atan2(e.clientY - screenCy, e.clientX - screenCx);
                   const deltaAngle = currAngle - startAngle;

                   const cos = Math.cos(deltaAngle);
                   const sin = Math.sin(deltaAngle);

                   newPoints = points.map(p => ({
                       x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
                       y: cy + (p.x - cx) * sin + (p.y - cy) * cos
                   }));
               }
               
               onPathDrawn(newPoints);
               return;
          }

          const updatedLayers = design.layers.map(l => {
              if (!design.selectedLayerIds.includes(l.id)) return l;
              
              const startState = initialLayersRef.current.get(l.id);
              if (!startState) return l;

              if (interactionMode === 'GIZMO_MOVE') {
                   const dxScreen = e.clientX - dragStartRef.current.x;
                   const dyScreen = e.clientY - dragStartRef.current.y;
                   const dxIntrinsic = dxScreen * scaleFactor;
                   const dyIntrinsic = dyScreen * scaleFactor;
                   const dxPercent = (dxIntrinsic / imgDims.w) * 100;
                   const dyPercent = (dyIntrinsic / imgDims.h) * 100;

                   return {
                       ...l,
                       overlayPosition: {
                           x: Math.max(0, Math.min(100, startState.overlayPosition.x + dxPercent)),
                           y: Math.max(0, Math.min(100, startState.overlayPosition.y + dyPercent))
                       }
                   };
              }

              if (interactionMode === 'GIZMO_SCALE') {
                   const primaryCx = rect.left + (primaryStartLayer.overlayPosition.x / 100) * rect.width;
                   const primaryCy = rect.top + (primaryStartLayer.overlayPosition.y / 100) * rect.height;
                   const startDist = Math.hypot(dragStartRef.current.x - primaryCx, dragStartRef.current.y - primaryCy);
                   const currDist = Math.hypot(e.clientX - primaryCx, e.clientY - primaryCy);
                   const ratio = currDist / (startDist || 1);
                   const newSize = Math.min(50, Math.max(0.1, startState.textSize * ratio));
                   return { ...l, textSize: newSize };
              }

              if (interactionMode === 'GIZMO_ROTATE') {
                   const primaryCx = rect.left + (primaryStartLayer.overlayPosition.x / 100) * rect.width;
                   const primaryCy = rect.top + (primaryStartLayer.overlayPosition.y / 100) * rect.height;
                   const angleRad = Math.atan2(e.clientY - primaryCy, e.clientX - primaryCx);
                   const startAngleRad = Math.atan2(dragStartRef.current.y - primaryCy, dragStartRef.current.x - primaryCx);
                   let deltaDeg = (angleRad - startAngleRad) * (180 / Math.PI);
                   let newAngle = startState.rotation + deltaDeg;
                   if (e.shiftKey) newAngle = Math.round(newAngle / 15) * 15;
                   newAngle = ((newAngle % 360) + 360) % 360;
                   return { ...l, rotation: newAngle };
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
      initialLayersRef.current.clear();
  };

  // --- Core Rendering Logic ---
  const renderLayerVisuals = (
      ctx: CanvasRenderingContext2D,
      layer: TextLayer,
      width: number,
      height: number,
      isPreview: boolean,
      forceUseCanvas: boolean = false
  ) => {
    if (!layer.visible) return;

    // In Preview Mode, we now render ALL standard text layers via DOM Overlay to prevent jumping.
    // Only Path layers are drawn here.
    const isStandardLayer = layer.pathPoints.length === 0;
    if (isPreview && !forceUseCanvas && isStandardLayer) return;

    // ... Standard Canvas Rendering ...
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    const isActive = layer.id === design.activeLayerId;
    const activePointsRaw = (interactionMode === 'DRAW_PATH' && isActive) ? currentPathRef.current : layer.pathPoints;
    const activePoints = (interactionMode === 'DRAW_PATH' && isActive) ? activePointsRaw : getSmoothedPoints(activePointsRaw, layer.pathSmoothing);

    if (interactionMode === 'DRAW_PATH' && isActive) return; 

    const fontSize = (layer.textSize / 100) * width;

    // Construct Font String (includes wght, wdth, slnt)
    ctx.font = constructCanvasFont(layer, width);
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

    const drawTextItem = (text: string, offsetX: number, offsetY: number, colorOverride?: string, forceHollow?: boolean, disableOutline: boolean = false) => {
        const isHollow = forceHollow !== undefined ? forceHollow : layer.isHollow;
        const shouldDrawOutline = !disableOutline && layer.hasOutline;

        ctx.save();

        if (activePoints && activePoints.length > 1) {
            // Path Text Logic...
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
                    while (distances[idx + 1] < charMidDist && idx < distances.length - 2) idx++;
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
            // Standard Text Rendering (Only for Fallback or Export)
            const xPos = (layer.overlayPosition.x / 100) * width;
            const yPos = (layer.overlayPosition.y / 100) * height;
            ctx.translate(xPos, yPos);
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
                
                if (layer.textAlign === 'left') startX = -(maxInkWidth / 2) - m.inkLeft;
                else if (layer.textAlign === 'right') startX = (maxInkWidth / 2) - m.inkRight;
                else startX = -(m.inkLeft + m.inkRight) / 2;
                
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
        }
        ctx.restore();
    };

    // Special Effects Rendering (Echo, Glitch, etc.)
    if (layer.specialEffect === 'echo') {
        const echoCount = 5;
        const startOpacity = 1.0;
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        const distanceStep = layer.effectIntensity * (width * 0.0005); 
        for (let i = echoCount; i > 0; i--) {
             const dx = Math.cos(angleRad) * distanceStep * i;
             const dy = Math.sin(angleRad) * distanceStep * i;
             ctx.globalAlpha = startOpacity * (0.1 + (0.5 * (1 - i/echoCount))); 
             drawTextItem(layer.textOverlay, dx, dy, undefined, layer.isHollow);
        }
    }

    if (layer.specialEffect === 'glitch') {
        const offset = (layer.effectIntensity / 100) * (fontSize * 0.5);
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        const rawText = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
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
            const dx = Math.cos(angleRad) * offset;
            const dy = Math.sin(angleRad) * offset;
            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen'; 
            drawTextItem(rawText, -dx, -dy, c1, false);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen';
            drawTextItem(rawText, dx, dy, c2, false); 
            ctx.restore();
        }
    }

    // Main Text Pass
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    drawTextItem(layer.textOverlay, 0, 0, undefined, undefined); 
    ctx.restore();
  };

  const renderToContext = useCallback(async (
      targetCtx: CanvasRenderingContext2D | null, 
      width: number, 
      height: number,
      layers: TextLayer[],
      isPreview: boolean = false,
      shouldClear: boolean = true,
      overrideBlendMode?: GlobalCompositeOperation,
      overrideBgImage?: HTMLImageElement,
      forceUseCanvas: boolean = false
  ) => {
      if (!targetCtx) return;

      // Use a double-buffering strategy.
      const buffer = getBufferCanvas(width, height);
      const bufferCtx = buffer.getContext('2d');
      if (!bufferCtx) return;

      // 1. Render Background to Buffer
      const bgImg = overrideBgImage || bgImageRef.current;
      
      // Clear Buffer
      bufferCtx.clearRect(0, 0, width, height);

      // Draw Background
      if (bgImg) {
          bufferCtx.drawImage(bgImg, 0, 0, width, height);
      }
      
      // 2. Render Layers to Buffer
      const scratch = getScratchCanvas(width, height);
      const scratchCtx = scratch.getContext('2d');
      
      for (const layer of layers) {
          if (!layer.visible) continue;
          if (!scratchCtx) continue;

          // Clear Scratch for this layer
          scratchCtx.clearRect(0, 0, width, height);
          
          // CRITICAL FIX: If we are in preview mode, and this layer is handled by DOM overlay, SKIP IT.
          // This prevents double rendering and misalignment.
          // Path Layers are always drawn in Canvas.
          const isDomHandled = isPreview && !forceUseCanvas && layer.pathPoints.length === 0;

          if (isDomHandled) {
              continue; // Handled by renderTextLayersOverlay
          }

          // If we are here, we are either exporting OR it is a Path Layer.
          // For Exporting standard layers, we use createTextSVG to get pixel-perfect variable fonts.
          const shouldUseSvgRenderer = !forceUseCanvas && layer.pathPoints.length === 0;

          if (shouldUseSvgRenderer) {
              const svgData = createTextSVG(layer, width, height);
              const img = new Image();
              
              const loadPromise = new Promise<boolean>((resolve) => {
                  img.onload = () => resolve(true);
                  img.onerror = () => resolve(false);
                  img.src = svgData;
              });

              // Add timeout race to prevent hanging
              const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500));

              const isLoaded = await Promise.race([loadPromise, timeoutPromise]);
              
              if (isLoaded) {
                  // If SVG loads, draw it
                  if (layer.hasShadow) {
                       const angleRad = (layer.shadowAngle * Math.PI) / 180;
                       const fontSize = (layer.textSize / 100) * width;
                       const dist = (layer.shadowOffset / 100) * fontSize;
                       const sx = dist * Math.cos(angleRad);
                       const sy = dist * Math.sin(angleRad);
                       const sAlpha = (layer.shadowOpacity ?? 1);
                       scratchCtx.save();
                       scratchCtx.shadowColor = hexToRgba(layer.shadowColor, sAlpha);
                       scratchCtx.shadowBlur = (layer.shadowBlur / 100) * (fontSize * 2);
                       scratchCtx.shadowOffsetX = sx;
                       scratchCtx.shadowOffsetY = sy;
                       
                       scratchCtx.drawImage(img, 0, 0);
                       scratchCtx.restore();
                  } else {
                       scratchCtx.drawImage(img, 0, 0);
                  }
              } else {
                  // Fallback to standard canvas rendering if SVG fails or times out
                  renderLayerVisuals(scratchCtx, layer, width, height, isPreview, forceUseCanvas);
              }
          } else {
              renderLayerVisuals(scratchCtx, layer, width, height, isPreview, forceUseCanvas);
          }

          // Composite Scratch to Buffer
          bufferCtx.save();
          bufferCtx.setTransform(1, 0, 0, 1, 0, 0); 
          const effectiveBlendMode = overrideBlendMode || (layer.blendMode === 'normal' ? 'source-over' : layer.blendMode);
          bufferCtx.globalAlpha = layer.opacity;
          bufferCtx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;

          // Apply Shadow for standard rendering (SVG renderer handled shadow above in scratch)
          if (!shouldUseSvgRenderer && layer.hasShadow) {
              const angleRad = (layer.shadowAngle * Math.PI) / 180;
              const fontSize = (layer.textSize / 100) * width;
              const dist = (layer.shadowOffset / 100) * fontSize;
              const sx = dist * Math.cos(angleRad);
              const sy = dist * Math.sin(angleRad);
              const sAlpha = (layer.shadowOpacity ?? 1);
              bufferCtx.shadowColor = hexToRgba(layer.shadowColor, sAlpha);
              bufferCtx.shadowBlur = (layer.shadowBlur / 100) * (fontSize * 2);
              bufferCtx.shadowOffsetX = sx;
              bufferCtx.shadowOffsetY = sy;
          }

          bufferCtx.drawImage(scratch, 0, 0);
          bufferCtx.restore();

          // 3. Render Path Line (if applicable)
          const isActive = layer.id === design.activeLayerId;
          const isDrawing = interactionMode === 'DRAW_PATH' && isActive;
          const activePointsRaw = isDrawing ? currentPathRef.current : layer.pathPoints;
          const activePoints = isDrawing ? activePointsRaw : getSmoothedPoints(activePointsRaw, layer.pathSmoothing);
          const showPathLine = isPreview && isActive && ((isDrawing && activePoints.length > 1) || (layer.isPathMoveMode && activePoints.length > 1));

          if (showPathLine) {
              bufferCtx.save();
              bufferCtx.beginPath();
              bufferCtx.strokeStyle = '#ec4899'; 
              bufferCtx.lineWidth = Math.max(2, width * 0.003); 
              bufferCtx.lineCap = 'round';
              bufferCtx.lineJoin = 'round';
              if (layer.isPathMoveMode && !isDrawing) {
                  bufferCtx.setLineDash([15, 15]); 
                  bufferCtx.globalAlpha = 0.6;
              }
              bufferCtx.moveTo(activePoints[0].x, activePoints[0].y);
              for(const p of activePoints) bufferCtx.lineTo(p.x, p.y);
              bufferCtx.stroke();
              bufferCtx.restore();
          }
      }

      // 4. COMMIT TO TARGET CONTEXT
      // Only clear and draw once everything is ready
      if (shouldClear) {
          targetCtx.clearRect(0, 0, width, height);
      }
      targetCtx.drawImage(buffer, 0, 0);

  }, [design.layers, interactionMode, design.activeLayerId]);

  // Live Preview Renderer
  useEffect(() => {
      if (textCanvasRef.current && imgDims) {
          const ctx = textCanvasRef.current.getContext('2d');
          textCanvasRef.current.width = imgDims.w;
          textCanvasRef.current.height = imgDims.h;
          renderToContext(ctx, imgDims.w, imgDims.h, design.layers, true, true);
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
    // Note: We pass isPreview=false here, which triggers the robust SVG renderer path
    await renderToContext(finalCtx, finalCanvas.width, finalCanvas.height, design.layers, false, true, undefined, img, true);
    return finalCanvas.toDataURL('image/png');
  }, [imageSrc, renderToContext, design.layers]);

  // Stamp Logic
  const stampLayers = useCallback(async (layerIds: string[]): Promise<string> => {
      if (!imageSrc) throw new Error("No image to stamp");
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
      const layersToStamp = design.layers.filter(l => layerIds.includes(l.id));
      await renderToContext(finalCtx, finalCanvas.width, finalCanvas.height, layersToStamp, false, true, undefined, img, true);
      return finalCanvas.toDataURL('image/png');
  }, [imageSrc, renderToContext, design.layers]);


  useImperativeHandle(ref, () => ({
    exportImage: generateExport,
    triggerFileUpload: () => fileInputRef.current?.click(),
    stampLayers: stampLayers
  }), [generateExport, stampLayers]);

  // DOM Overlay Renderer for ALL Standard Text Layers
  // This ensures consistent rendering between "Active" and "Inactive" states during editing
  const renderTextLayersOverlay = () => {
      if (!imgDims) return null;

      // We only render non-path layers here. Path layers stay on the canvas.
      const layersToRender = design.layers.filter(l => l.visible && l.pathPoints.length === 0);

      if (layersToRender.length === 0) return null;

      return (
          <div 
            className="absolute inset-0 pointer-events-none z-40 overflow-hidden"
            // Use NATURAL RESOLUTION for the container to match pixel calculations
            // Then Scale it down to fit visually using CSS Transform
            style={{ 
                width: imgDims.w,
                height: imgDims.h,
                transform: `scale(${visualScale})`,
                transformOrigin: 'top left',
                left: 0,
                top: 0
            }}
          >
              {layersToRender.map(layer => {
                  const variationSettings = getFontVariationSettings(layer);
                  // We deliberately DO NOT use constructCanvasFont here to prevent the 'font' shorthand
                  // from resetting our custom font-variation-settings.
                  
                  const xPct = layer.overlayPosition.x;
                  const yPct = layer.overlayPosition.y;
                  
                  const fontSizePx = (layer.textSize / 100) * imgDims.w;
                  
                  // Calculate Font Styles explicitely
                  const fontWeight = layer.fontVariations && layer.fontVariations['wght'] !== undefined 
                      ? Math.round(layer.fontVariations['wght']) 
                      : (layer.isBold ? 700 : 400);
                  
                  let fontStyle = layer.isItalic ? 'italic' : 'normal';
                  if (layer.fontVariations && layer.fontVariations['slnt'] !== undefined && layer.fontVariations['slnt'] !== 0) {
                      fontStyle = `oblique ${Math.abs(layer.fontVariations['slnt'])}deg`;
                  }

                  const textToRender = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
                  const lines = textToRender.split('\n');
                  
                  // Shadow Math
                  const angleRad = (layer.shadowAngle * Math.PI) / 180;
                  const shadowDist = (layer.shadowOffset / 100) * fontSizePx;
                  const sX = shadowDist * Math.cos(angleRad);
                  const sY = shadowDist * Math.sin(angleRad);
                  const sBlur = (layer.shadowBlur / 100) * fontSizePx * 2;
                  const sColor = hexToRgba(layer.shadowColor, layer.shadowOpacity ?? 1);

                  return (
                      <div 
                          key={layer.id}
                          style={{
                              position: 'absolute',
                              left: `${xPct}%`,
                              top: `${yPct}%`,
                              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
                              transformOrigin: 'center center',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: layer.textAlign === 'center' ? 'center' : layer.textAlign === 'right' ? 'flex-end' : 'flex-start',
                              minWidth: '10px',
                              textAlign: layer.textAlign,
                              
                              // Explicit Font Properties (Avoiding shorthand to preserve variable axes)
                              fontFamily: `"${layer.fontFamily}"`,
                              fontSize: `${fontSizePx}px`,
                              fontWeight: fontWeight,
                              fontStyle: fontStyle,
                              fontVariationSettings: variationSettings,

                              color: layer.textColor,
                              lineHeight: 1.0,
                              letterSpacing: `${layer.letterSpacing * (fontSizePx/50)}px`,
                              
                              // Consistent Text Rendering
                              fontSynthesis: 'none',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              
                              // Correct Shadow Implementation for CSS Text
                              textShadow: layer.hasShadow 
                                  ? `${sX}px ${sY}px ${sBlur}px ${sColor}`
                                  : 'none',
                              
                              // Special Effects (Simple CSS Mappings)
                              ...(layer.hasOutline ? {
                                  WebkitTextStroke: `${layer.outlineWidth}px ${layer.outlineColor}`,
                              } : {}),
                              ...(layer.isHollow ? {
                                  color: 'transparent',
                                  WebkitTextStroke: `${layer.hasOutline ? layer.outlineWidth : 2}px ${layer.hasOutline ? layer.outlineColor : layer.textColor}`
                              } : {}),
                              opacity: layer.opacity,
                              mixBlendMode: layer.blendMode === 'normal' ? 'normal' : layer.blendMode as any,
                              zIndex: design.layers.findIndex(l => l.id === layer.id) // Respect layering
                          }}
                      >
                          {lines.map((line, i) => (
                              <div key={i} style={{ whiteSpace: 'pre', display: 'block' }}>
                                  {line.split('').map((char, j) => (
                                      <span key={j} style={{ 
                                          display: 'inline-block',
                                          transform: layer.letterRotation !== 0 ? `rotate(${layer.letterRotation}deg)` : 'none'
                                      }}>
                                          {char === ' ' ? '\u00A0' : char}
                                      </span>
                                  ))}
                              </div>
                          ))}
                      </div>
                  );
              })}
          </div>
      );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDraggingFile(true);
    e.dataTransfer.dropEffect = 'copy';
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDraggingFile(false);
  };

  const loadUrlImage = async (imageUrl: string) => {
        try {
            const response = await fetch(imageUrl, { mode: 'cors' });
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            
            const blob = await response.blob();
            if (blob.type.startsWith('image/')) {
                let filename = 'dropped-image';
                try {
                    const urlPath = new URL(imageUrl).pathname;
                    const name = urlPath.substring(urlPath.lastIndexOf('/') + 1);
                    if (name) filename = name;
                } catch (e) {
                }
                if (blob.type === 'image/webp' && !filename.endsWith('.webp')) filename += '.webp';
                else if (blob.type === 'image/png' && !filename.endsWith('.png')) filename += '.png';
                else if (blob.type === 'image/jpeg' && !filename.endsWith('.jpg')) filename += '.jpg';
                const file = new File([blob], filename, { type: blob.type });
                onImageUpload(file);
            }
        } catch (error) {
            console.error("Error processing dropped image URL:", error);
        }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
            onImageUpload(file);
            return;
        }
        if (file.name.endsWith('.webloc')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = ev.target?.result as string;
                const match = content.match(/<key>URL<\/key>\s*<string>(.*?)<\/string>/s);
                if (match && match[1]) {
                    loadUrlImage(match[1]);
                } else {
                    const looseMatch = content.match(/<string>(https?:\/\/[^<]+)<\/string>/);
                    if (looseMatch && looseMatch[1]) loadUrlImage(looseMatch[1]);
                }
            };
            reader.readAsText(file);
            return;
        }
        if (file.name.endsWith('.url')) {
             const reader = new FileReader();
             reader.onload = (ev) => {
                 const content = ev.target?.result as string;
                 const match = content.match(/URL=(.*)/);
                 if (match && match[1]) loadUrlImage(match[1].trim());
             };
             reader.readAsText(file);
             return;
        }
        return;
    }
    const uriList = e.dataTransfer.getData('text/uri-list');
    const html = e.dataTransfer.getData('text/html');
    const plainText = e.dataTransfer.getData('text/plain');
    let imageUrl = '';
    if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        if (img && img.src) imageUrl = img.src;
    }
    if (!imageUrl && uriList) {
        const lines = uriList.split(/\r?\n/);
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                imageUrl = line.trim();
                break;
            }
        }
    }
    if (!imageUrl && plainText) {
        const trimmed = plainText.trim();
        if (trimmed.match(/^https?:\/\//i)) imageUrl = trimmed;
    }
    if (imageUrl) loadUrlImage(imageUrl);
  };

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
    if (design.orientation === 'portrait') { const temp = w; w = h; h = temp; }
    const numericRatio = w / h;
    const isPortrait = design.orientation === 'portrait';
    const SHORT_EDGE_SIZE = '28rem'; 
    let calculatedWidthConstraint;
    if (isPortrait) calculatedWidthConstraint = SHORT_EDGE_SIZE;
    else calculatedWidthConstraint = `calc(${SHORT_EDGE_SIZE} * ${numericRatio})`;
    const heightBasedWidthConstraint = `calc(80vh * ${numericRatio})`;
    return {
        width: `min(90%, ${calculatedWidthConstraint}, ${heightBasedWidthConstraint})`,
        aspectRatio: `${numericRatio}`,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
        transformOrigin: 'center center'
    };
  };

  const getContainerClass = () => {
      if (imageSrc) return 'w-auto h-auto max-w-full max-h-full';
      return 'shadow-2xl'; 
  };
  
  let cursorStyle = 'default';
  if (activeLayer?.isPathInputMode) cursorStyle = 'crosshair';
  else if (activeLayer?.isPathMoveMode) cursorStyle = 'move';
  else if (interactionMode === 'GIZMO_ROTATE') cursorStyle = 'grabbing';
  else if (interactionMode === 'GIZMO_SCALE') {
      if (activeGizmoHandle === 'tr' || activeGizmoHandle === 'bl') cursorStyle = 'nesw-resize';
      else cursorStyle = 'nwse-resize';
  }
  else if (interactionMode === 'GIZMO_MOVE') cursorStyle = 'move';
  else if (interactionMode === 'PAN') cursorStyle = 'grabbing';
  else if (imageSrc) cursorStyle = 'grab';

  const invScale = 1 / zoomScale;
  const cornerSize = 8 * invScale;
  const cornerOffset = -4 * invScale;
  const boxBorderWidth = 1 * invScale;
  const rotHandleSize = 40 * invScale;
  const rotStemHeight = 32 * invScale;
  const rotHandleOffset = -rotStemHeight; 

  const renderGizmo = (layerId: string, isPrimary: boolean) => {
      const layer = design.layers.find(l => l.id === layerId);
      if (!layer || !imgDims) return null;
      let gx = 0, gy = 0, gw = 0, gh = 0, gr = 0;
      if (layer.isPathMoveMode && layer.pathPoints.length > 0) {
          const b = getPathBounds(layer.pathPoints);
          gx = (b.cx / imgDims.w) * 100;
          gy = (b.cy / imgDims.h) * 100;
          gw = b.width * visualScale;
          gh = b.height * visualScale;
          gr = 0; 
      } else {
          const bounds = textBounds[layerId];
          if (!bounds) return null; 
          gx = layer.overlayPosition.x;
          gy = layer.overlayPosition.y;
          gw = bounds.width * visualScale;
          gh = bounds.height * visualScale;
          gr = layer.rotation;
      }

      return (
        <div
            key={layerId}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (onLayerDoubleClicked) onLayerDoubleClicked(layerId);
            }}
            className={`absolute pointer-events-none group z-[60]`}
            style={{
                left: `${gx}%`,
                top: `${gy}%`,
                width: gw,
                height: gh,
                transform: `translate(-50%, -50%) rotate(${gr}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
            }}
        >
            <div 
                data-handle={isPrimary ? "box" : undefined}
                className={`absolute inset-0 border-dashed ${isPrimary ? 'border-white/60 hover:border-pink-500/80 cursor-move pointer-events-auto' : 'border-white/30'}`}
                style={{ borderWidth: `${boxBorderWidth}px` }}
            ></div>
            {isPrimary && (
                <>
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
                    <div 
                        className="absolute left-1/2 -translate-x-1/2 bg-pink-500/50" 
                        style={{
                            top: 0,
                            width: `${1 * invScale}px`,
                            height: `${rotStemHeight}px`,
                            transform: `translateY(-100%)`
                        }}
                    />
                    <div 
                        data-handle="rotate"
                        className="absolute left-1/2 bg-white/10 hover:bg-pink-500/20 border-white/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto cursor-grab shadow-lg transition-colors rounded-full"
                        style={{
                            width: `${rotHandleSize}px`,
                            height: `${rotHandleSize}px`,
                            top: `${rotHandleOffset}px`,
                            transform: `translate(-50%, -50%)`, 
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
                    <div 
                        className="absolute top-1/2 left-1/2 bg-pink-500 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                        style={{ width: `${4 * invScale}px`, height: `${4 * invScale}px` }}
                    ></div>
                </>
            )}
        </div>
      );
  };

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
      onDoubleClick={handleCanvasDoubleClick}
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

                {/* DOM OVERLAY FOR ALL TEXT LAYERS */}
                {renderTextLayersOverlay()}
                
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

            {imgDims && design.selectedLayerIds.map(layerId => {
                const layer = design.layers.find(l => l.id === layerId);
                if (!layer || layer.isPathInputMode) return null;
                if (layer.pathPoints.length > 0 && !layer.isPathMoveMode) return null;
                const isPrimary = layerId === design.activeLayerId;
                return renderGizmo(layerId, isPrimary);
            })}

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
             <div className="w-full h-full bg-neutral-950 relative overflow-hidden flex flex-col items-center justify-center gap-4 border border-neutral-900 shadow-inner">
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
