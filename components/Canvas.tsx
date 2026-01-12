

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
  resetView: () => void;
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

// Helper: Check if font supports external CSS shadows
const isShadowSupported = (fontFamily: string) => {
    // Honk has baked-in shadows/3D effects controlled by axes
    return fontFamily !== 'Honk'; 
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

const constructCanvasFont = (layer: TextLayer, fontSizePx: number): string => {
    const fontFamily = `"${layer.fontFamily}"`;
    // Canvas font strings handle weight/style, but standard axes support varies.
    // We construct the basic descriptors here.
    let weight = layer.isBold ? 700 : 400;
    if (layer.fontVariations && layer.fontVariations['wght'] !== undefined) {
        weight = Math.round(layer.fontVariations['wght']);
    }
    let stretch = "normal";
    if (layer.fontVariations && layer.fontVariations['wdth'] !== undefined) {
        const wVal = layer.fontVariations['wdth'];
        if (wVal !== 100) stretch = `${Math.round(wVal)}%`;
    }
    let style = layer.isItalic ? 'italic' : 'normal';
    if (layer.fontVariations && layer.fontVariations['slnt'] !== undefined) {
        const slnt = layer.fontVariations['slnt'];
        // Use negative slnt for oblique angle because OpenType slnt is usually negative for clockwise slant,
        // while CSS oblique angle is positive for clockwise slant.
        if (slnt !== 0) style = `oblique ${-slnt}deg`;
    }
    // Canvas 2D font parser can be strict. Remove /1 line-height shorthand.
    return `${style} normal ${weight} ${stretch} ${fontSizePx}px ${fontFamily}`;
};

const getFontVariationSettings = (layer: TextLayer): string => {
    if (!layer.fontVariations || Object.keys(layer.fontVariations).length === 0) {
        return 'normal';
    }
    return Object.entries(layer.fontVariations)
        .map(([key, val]) => `"${key}" ${val}`)
        .join(', ');
};

// Helper: Generate Standard Text Layout (Local Coordinates)
const calculateStandardLayout = (ctx: CanvasRenderingContext2D, layer: TextLayer, fontSizePx: number) => {
    const text = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
    const lines = text.split('\n');
    const lineHeight = fontSizePx; // line-height: 1
    const scaledLetterSpacing = layer.letterSpacing * (fontSizePx / 50);
    
    const layout: { char: string, x: number, y: number, r: number }[] = [];
    
    // 1. Measure all lines to determine block dimensions
    const lineMetrics = lines.map(line => {
        let width = 0;
        const chars = line.split('');
        chars.forEach((char, i) => {
             width += ctx.measureText(char).width;
             // CSS usually includes trailing spacing in centered block calculations
             width += scaledLetterSpacing; 
        });
        return { line, width, chars };
    });
    
    const totalHeight = lines.length * lineHeight;
    // Align so that (0,0) is the center of the text block
    // Using TOP baseline alignment logic for calculations to match CSS box model
    const startY = -(totalHeight / 2); 
    const maxLineWidth = Math.max(...lineMetrics.map(m => m.width));
    
    lineMetrics.forEach((metric, lineIdx) => {
        // Calculate X start for this line relative to the BLOCK CENTER
        let lineX = 0;
        
        if (layer.textAlign === 'left') {
            lineX = -maxLineWidth / 2;
        } else if (layer.textAlign === 'center') {
            lineX = -metric.width / 2;
        } else if (layer.textAlign === 'right') {
            lineX = maxLineWidth / 2 - metric.width;
        }
        
        const lineY = startY + (lineIdx * lineHeight);
        
        let cursorX = lineX;
        metric.chars.forEach(char => {
             const w = ctx.measureText(char).width;
             
             const boxWidth = w + scaledLetterSpacing;
             const charCenterX = cursorX + (boxWidth / 2) - (scaledLetterSpacing / 2); // Center of the glyph itself
             
             // For Y, we need center of the line height
             const charCenterY = lineY + (lineHeight / 2);

             layout.push({
                 char,
                 x: charCenterX,
                 y: charCenterY,
                 r: layer.letterRotation
             });
             cursorX += w + scaledLetterSpacing;
        });
    });
    
    return layout;
};

// Helper: Calculate Path Character Positions (Absolute Coordinates)
const calculatePathLayout = (ctx: CanvasRenderingContext2D, layer: TextLayer, fontSizePx: number) => {
    const scaledLetterSpacing = layer.letterSpacing * (fontSizePx/50);
    
    // 1. Get Path Points
    const smoothedPoints = getSmoothedPoints(layer.pathPoints, layer.pathSmoothing);
    if (smoothedPoints.length < 2) return [];

    // 2. Calculate Cumulative Distances along path
    const distances = [0];
    for (let i = 1; i < smoothedPoints.length; i++) {
        const dx = smoothedPoints[i].x - smoothedPoints[i-1].x;
        const dy = smoothedPoints[i].y - smoothedPoints[i-1].y;
        distances.push(distances[i-1] + Math.sqrt(dx*dx + dy*dy));
    }
    const totalPathLen = distances[distances.length - 1];

    // 3. Prepare Text
    const text = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
    const singleLineText = text.replace(/\n/g, ' ');

    // 4. Measure Total Text Width
    let totalTextWidth = 0;
    const charWidths = singleLineText.split('').map(char => {
        const w = ctx.measureText(char).width;
        totalTextWidth += w + scaledLetterSpacing;
        return w;
    });
    if (charWidths.length > 0) totalTextWidth -= scaledLetterSpacing;

    // 5. Determine Start Offset based on Align
    let currentDist = 0;
    if (layer.textAlign === 'center') currentDist = (totalPathLen - totalTextWidth) / 2;
    if (layer.textAlign === 'right') currentDist = totalPathLen - totalTextWidth;
    
    const layout = [];

    for (let i = 0; i < singleLineText.length; i++) {
        const char = singleLineText[i];
        const charW = charWidths[i];
        const charMidDist = currentDist + (charW / 2);

        if (charMidDist >= 0 && charMidDist <= totalPathLen) {
            let idx = 0;
            while (distances[idx + 1] < charMidDist && idx < distances.length - 2) idx++;
            
            const p1 = smoothedPoints[idx];
            const p2 = smoothedPoints[idx+1];
            const segStart = distances[idx];
            const segLen = distances[idx+1] - segStart;
            const t = (charMidDist - segStart) / (segLen || 1); 
            
            const xBase = p1.x + (p2.x - p1.x) * t;
            const yBase = p1.y + (p2.y - p1.y) * t;
            
            const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const finalRotation = (angleRad * 180 / Math.PI) + layer.letterRotation;

            layout.push({
                char,
                x: xBase,
                y: yBase,
                r: finalRotation
            });
        }
        currentDist += charW + scaledLetterSpacing;
    }
    return layout;
};

// --- Core Canvas Renderer ---
const drawLayerToCtx = (ctx: CanvasRenderingContext2D, layer: TextLayer, width: number, height: number) => {
    const fontSizePx = (layer.textSize / 100) * width;
    
    // CRITICAL: Apply font variations to the canvas context directly via the canvas element style
    if (ctx.canvas) {
        ctx.canvas.style.fontVariationSettings = getFontVariationSettings(layer);
        ctx.canvas.style.letterSpacing = '0px'; 
    }

    ctx.font = constructCanvasFont(layer, fontSizePx);
    ctx.textBaseline = 'middle'; // Center in the glyph box for rotation
    ctx.textAlign = 'center'; 

    const isPath = layer.pathPoints.length > 0;
    
    // 1. Calculate Layout (Chars with positions)
    const layout = isPath 
        ? calculatePathLayout(ctx, layer, fontSizePx)
        : calculateStandardLayout(ctx, layer, fontSizePx);
    
    if (!layout || layout.length === 0) return;

    // Helper to draw the set of characters
    const renderPass = (
        color: string | CanvasGradient, 
        offsetX: number, 
        offsetY: number, 
        blurPx: number, 
        opacity: number, 
        compositeOp: GlobalCompositeOperation, 
        mode: 'standard' | 'shadow-only' | 'outline-only' | 'fill-only',
        forceSolid: boolean = false
    ) => {
        ctx.save();
        
        // Transform for Standard Layout (Rotate/Position Layer)
        if (!isPath) {
            const cx = (layer.overlayPosition.x / 100) * width;
            const cy = (layer.overlayPosition.y / 100) * height;
            ctx.translate(cx, cy);
            ctx.rotate(layer.rotation * Math.PI / 180);
            ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        }

        ctx.globalAlpha = opacity * layer.opacity;
        ctx.globalCompositeOperation = compositeOp;

        // --- SHADOW PASS ---
        if (mode === 'shadow-only') {
             const angleRad = (layer.shadowAngle * Math.PI) / 180;
             const dist = (layer.shadowOffset / 100) * fontSizePx;
             
             const sX = dist * Math.cos(angleRad);
             const sY = dist * Math.sin(angleRad);

             // Restore multiplier to 0.5 to match CSS text-shadow visual blur strength
             const shadowBlurPx = (layer.shadowBlur / 100) * fontSizePx * 0.5;

             // FIX: Use native Canvas shadow properties instead of filter for robust export.
             // We use the "offscreen casting" technique: draw the text far off-canvas,
             // and use a large shadow offset to cast the shadow back onto the visible area.
             // This ensures only the shadow is visible, and blurring is handled natively by the engine.
             
             const OFFSCREEN_OFFSET = 100000; 

             ctx.shadowColor = hexToRgba(layer.shadowColor, layer.shadowOpacity ?? 1);
             ctx.shadowBlur = shadowBlurPx;
             ctx.shadowOffsetX = OFFSCREEN_OFFSET + sX;
             ctx.shadowOffsetY = sY;
             ctx.fillStyle = "#000000"; // Dummy color for the offscreen text (must be opaque to cast shadow)

             layout.forEach(item => {
                 ctx.save();
                 // Move text offscreen to the left (relative to its own rotation frame)
                 ctx.translate(item.x + offsetX - OFFSCREEN_OFFSET, item.y + offsetY);
                 ctx.rotate(item.r * Math.PI / 180);
                 // No need to translate sX, sY here as it's handled by shadowOffset relative to the draw origin
                 ctx.fillText(item.char, 0, 0);
                 ctx.restore();
             });
             
             ctx.restore();
             return;
        }

        // --- STANDARD PASSES ---
        if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;

        // Setup Fill Style
        let fillStyle: string | CanvasGradient = 'transparent';
        if (layer.specialEffect === 'gradient' && !layer.isHollow && typeof color === 'string') {
             // ADJUSTMENT: Subtract 90 degrees to align Canvas gradient angle (0=Right) with CSS linear-gradient (0=Up)
             const angleRad = ((layer.effectAngle - 90) * Math.PI) / 180;
             const range = fontSizePx * 5; 
             const x1 = Math.cos(angleRad) * -range;
             const y1 = Math.sin(angleRad) * -range;
             const x2 = Math.cos(angleRad) * range;
             const y2 = Math.sin(angleRad) * range;
             
             const grad = ctx.createLinearGradient(x1, y1, x2, y2);
             grad.addColorStop(0, layer.textColor);
             grad.addColorStop(1, layer.effectColor);
             fillStyle = grad;
        } else {
             fillStyle = color;
        }

        layout.forEach(item => {
            ctx.save();
            ctx.translate(item.x + offsetX, item.y + offsetY);
            ctx.rotate(item.r * Math.PI / 180);

            // OUTLINE ONLY PASS
            if (mode === 'outline-only' || mode === 'standard') {
                if (layer.hasOutline) {
                    ctx.strokeStyle = layer.outlineColor;
                    ctx.lineWidth = layer.outlineWidth; 
                    ctx.strokeText(item.char, 0, 0);
                }
            }

            // FILL/HOLLOW PASS
            if (mode === 'fill-only' || mode === 'standard') {
                if (layer.isHollow && !forceSolid) {
                    ctx.strokeStyle = typeof color === 'string' ? color : layer.textColor;
                    ctx.lineWidth = Math.max(1, fontSizePx * 0.02); 
                    ctx.strokeText(item.char, 0, 0);
                } else {
                    ctx.fillStyle = fillStyle;
                    ctx.fillText(item.char, 0, 0);
                }
            }

            ctx.restore();
        });

        ctx.restore();
    };

    // --- Rendering Pipeline ---
    // Order: Shadow -> Echo -> Glitch -> Main
    // This ensures Shadow is absolutely at the bottom.

    // 1. Shadow Pass
    if (layer.hasShadow && isShadowSupported(layer.fontFamily)) {
        renderPass('#000000', 0, 0, 0, 1, 'source-over', 'shadow-only');
    }

    // 2. Echo Effect (Background Trails)
    if (layer.specialEffect === 'echo') {
        const echoCount = 5;
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        const distanceStep = layer.effectIntensity * (width * 0.0005);
        for (let i = echoCount; i >= 1; i--) {
             const dx = Math.cos(angleRad) * distanceStep * i;
             const dy = Math.sin(angleRad) * distanceStep * i;
             const alpha = 0.5 * (1 - i/echoCount);
             // Use 'fill-only' to avoid applying the outline stroke to the echo
             // Pass forceSolid=true to ensure echo is solid even if main text is hollow
             renderPass(layer.textColor, dx, dy, 0, alpha, 'source-over', 'fill-only', true);
        }
    }

    // 3. Glitch Effects
    if (layer.specialEffect === 'glitch') {
        const offsetBase = (layer.effectIntensity / 100) * (fontSizePx * 0.2);
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        
        const glitchBlend = (!layer.isRainbowGlitch || layer.isRainbowLights) ? 'screen' : 'source-over';

        if (layer.isRainbowGlitch) {
             const rainbowColors = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#8f00ff', '#4b0082'];
             const spreadFactor = 3.0;
             rainbowColors.forEach((color, i) => {
                const indexOffset = i - (rainbowColors.length - 1) / 2;
                const dist = (indexOffset * offsetBase * spreadFactor) / 2;
                const dx = Math.cos(angleRad) * dist;
                const dy = Math.sin(angleRad) * dist;
                // Use 'fill-only' to avoid applying the outline stroke to the glitch layers
                // Pass forceSolid=true to ensure glitch is solid even if main text is hollow
                renderPass(color, dx, dy, layer.rainbowBlur, layer.rainbowOpacity, glitchBlend, 'fill-only', true);
             });
        } else {
             const dx = Math.cos(angleRad) * offsetBase;
             const dy = Math.sin(angleRad) * offsetBase;
             // Use 'fill-only' to avoid applying the outline stroke to the glitch layers
             // Pass forceSolid=true to ensure glitch is solid even if main text is hollow
             renderPass(layer.effectColor, -dx, -dy, 1, 1, glitchBlend, 'fill-only', true);
             renderPass(layer.effectColor2, dx, dy, 1, 1, glitchBlend, 'fill-only', true);
        }
    }

    // 4. Main Text Pass
    if (layer.hasOutline) {
         renderPass(layer.textColor, 0, 0, 0, 1, 'source-over', 'outline-only');
    }
    renderPass(layer.textColor, 0, 0, 0, 1, 'source-over', 'fill-only');
};

// Helper: Get text metrics (Tight Ink Bounds) for Gizmo
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
        
        // Match width calculation to standard layout (include spacing)
        currentX += metrics.width + letterSpacing;
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
    ctx.font = constructCanvasFont(layer, fontSize);
    
    // Apply variations to context for measurement too!
    if (ctx.canvas) {
        ctx.canvas.style.fontVariationSettings = getFontVariationSettings(layer);
        ctx.canvas.style.letterSpacing = '0px'; 
    }

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
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  const resetView = useCallback(() => {
      setZoomScale(1);
      setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    // Only reset if imageSrc effectively clears (e.g. going back to null)
    // We do NOT auto-reset zoom on imageSrc change anymore to support Stamping/Undoing
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
          resetView();
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

      const buffer = getBufferCanvas(width, height);
      const bufferCtx = buffer.getContext('2d');
      if (!bufferCtx) return;
      
      // Ensure high quality scaling
      bufferCtx.imageSmoothingEnabled = true;
      bufferCtx.imageSmoothingQuality = 'high';

      // 1. Render Background
      const bgImg = overrideBgImage || bgImageRef.current;
      if (shouldClear) bufferCtx.clearRect(0, 0, width, height);
      
      // NEW: Draw Solid Background Color if type is solid
      if (design.backgroundType === 'solid') {
          bufferCtx.fillStyle = design.backgroundColor;
          bufferCtx.fillRect(0, 0, width, height);
      }

      if (bgImg) {
          bufferCtx.drawImage(bgImg, 0, 0, width, height);
      }
      
      // 2. Render Layers
      const scratch = getScratchCanvas(width, height);
      const scratchCtx = scratch.getContext('2d');
      
      for (const layer of layers) {
          if (!layer.visible) continue;
          if (!scratchCtx) continue;

          scratchCtx.clearRect(0, 0, width, height);
          scratchCtx.imageSmoothingEnabled = true;
          scratchCtx.imageSmoothingQuality = 'high';
          
          if (isPreview && !forceUseCanvas) {
              // No-op for visual text (React rendered overlays)
          } else {
              // EXPORT MODE or FALLBACK: Use Native Canvas Renderer
              await document.fonts.ready;
              
              const needsDomAttach = true; 
              let attached = false;
              if (needsDomAttach && !scratch.isConnected) {
                  scratch.style.position = 'absolute';
                  scratch.style.visibility = 'hidden';
                  scratch.style.pointerEvents = 'none';
                  document.body.appendChild(scratch);
                  attached = true;
              }

              try {
                  const variationSettings = getFontVariationSettings(layer);
                  scratch.style.fontVariationSettings = variationSettings;
                  scratch.style.letterSpacing = '0px';

                  drawLayerToCtx(scratchCtx, layer, width, height);
              } finally {
                  if (attached) {
                      document.body.removeChild(scratch);
                  }
              }
          }

          // Composite Scratch to Buffer
          bufferCtx.save();
          bufferCtx.setTransform(1, 0, 0, 1, 0, 0); 
          
          // Apply opacity and blend mode here to composite the entire layer as a whole
          bufferCtx.globalAlpha = layer.opacity; 
          
          const gcoMap: Record<string, GlobalCompositeOperation> = {
              'normal': 'source-over',
              'multiply': 'multiply',
              'screen': 'screen',
              'overlay': 'overlay',
              'darken': 'darken',
              'lighten': 'lighten',
              'color-dodge': 'color-dodge',
              'color-burn': 'color-burn',
              'hard-light': 'hard-light',
              'soft-light': 'soft-light',
              'difference': 'difference',
              'exclusion': 'exclusion',
              'hue': 'hue',
              'saturation': 'saturation',
              'color': 'color',
              'luminosity': 'luminosity'
          };
          const effectiveBlendMode = overrideBlendMode || gcoMap[layer.blendMode] || 'source-over';
          bufferCtx.globalCompositeOperation = effectiveBlendMode;
          bufferCtx.drawImage(scratch, 0, 0);
          bufferCtx.restore();

          // 3. Render Interactive Path Line (Pink Line) - Only in Preview
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

      if (shouldClear) {
          targetCtx.clearRect(0, 0, width, height);
      }
      targetCtx.drawImage(buffer, 0, 0);

  }, [design.layers, interactionMode, design.activeLayerId, design.backgroundColor, design.backgroundType]);

  // Live Preview Renderer
  useEffect(() => {
      if (textCanvasRef.current && imgDims) {
          const ctx = textCanvasRef.current.getContext('2d');
          textCanvasRef.current.width = imgDims.w;
          textCanvasRef.current.height = imgDims.h;
          renderToContext(ctx, imgDims.w, imgDims.h, design.layers, true, true);
      }
  }, [imgDims, design, renderToContext]);

  // Font Load Listener: Trigger redraw when fonts become available
  useEffect(() => {
    const handleFontLoad = () => {
        // Force update by triggering render if dimensions exist
        if (textCanvasRef.current && imgDims) {
            const ctx = textCanvasRef.current.getContext('2d');
            renderToContext(ctx, imgDims.w, imgDims.h, design.layers, true, true);
        }
    };
    
    document.fonts.addEventListener('loadingdone', handleFontLoad);
    return () => {
        document.fonts.removeEventListener('loadingdone', handleFontLoad);
    };
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
    stampLayers: stampLayers,
    resetView: resetView
  }), [generateExport, stampLayers, resetView]);

  // --- DOM Overlay Renderer ---
  const renderTextLayersOverlay = () => {
      if (!imgDims) return null;

      const layersToRender = design.layers.filter(l => l.visible);
      if (layersToRender.length === 0) return null;

      return (
          <div 
            className="absolute inset-0 pointer-events-none z-40 overflow-hidden"
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
                  const fontSizePx = (layer.textSize / 100) * imgDims.w;
                  
                  const fontWeight = layer.fontVariations && layer.fontVariations['wght'] !== undefined 
                      ? Math.round(layer.fontVariations['wght']) 
                      : (layer.isBold ? 700 : 400);
                  
                  let fontStyle = layer.isItalic ? 'italic' : 'normal';
                  if (layer.fontVariations && layer.fontVariations['slnt'] !== undefined && layer.fontVariations['slnt'] !== 0) {
                      // Use negative slnt for oblique angle because OpenType slnt is usually negative for clockwise slant,
                      // while CSS oblique angle is positive for clockwise slant.
                      fontStyle = `oblique ${-layer.fontVariations['slnt']}deg`;
                  }

                  // Wrapper style handles global blending and opacity for the "apply as a whole" effect
                  const wrapperStyle: React.CSSProperties = {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: design.layers.findIndex(l => l.id === layer.id) * 10,
                      mixBlendMode: layer.blendMode === 'normal' ? 'normal' : layer.blendMode as any,
                      opacity: layer.opacity,
                  };

                  // --- SHADOW SETUP (Independent of Text Shadow property for main text) ---
                  let shadowString = 'none';
                  if (layer.hasShadow && isShadowSupported(layer.fontFamily)) {
                        const angleRad = (layer.shadowAngle * Math.PI) / 180;
                        const shadowDist = (layer.shadowOffset / 100) * fontSizePx;
                        const sX = shadowDist * Math.cos(angleRad);
                        const sY = shadowDist * Math.sin(angleRad);
                        const sBlur = (layer.shadowBlur / 100) * fontSizePx * 0.5; 
                        const sColor = hexToRgba(layer.shadowColor, layer.shadowOpacity ?? 1);
                        shadowString = `${sX}px ${sY}px ${sBlur}px ${sColor}`;
                  }

                  // Base container style for internal components
                  const baseStyle: React.CSSProperties = {
                      position: 'absolute',
                      fontFamily: `"${layer.fontFamily}"`,
                      fontSize: `${fontSizePx}px`,
                      fontWeight: fontWeight,
                      fontStyle: fontStyle,
                      fontVariationSettings: variationSettings,
                      lineHeight: 1.0,
                      letterSpacing: `${layer.letterSpacing * (fontSizePx/50)}px`,
                      fontSynthesis: 'style weight',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textShadow: 'none',
                  };

                  // --- CONTENT RENDERER ---
                  const renderContent = (mode: 'outline' | 'fill', extraStyle?: React.CSSProperties) => {
                      const modeStyle: React.CSSProperties = {
                           ...baseStyle,
                           ...extraStyle
                      };

                      if (mode === 'outline') {
                          if (!layer.hasOutline) return null;
                          modeStyle.color = 'transparent';
                          modeStyle.WebkitTextStroke = `${layer.outlineWidth}px ${layer.outlineColor}`;
                          modeStyle.textShadow = 'none'; 
                      } 
                      else if (mode === 'fill') {
                           const hasExplicitColor = extraStyle && 'color' in extraStyle;
                           const hasExplicitShadow = extraStyle && 'textShadow' in extraStyle;
                           
                           if (!hasExplicitColor) {
                                if (layer.isHollow) {
                                        modeStyle.color = 'transparent';
                                        modeStyle.WebkitTextStroke = `${Math.max(1, fontSizePx * 0.02)}px ${layer.textColor}`;
                                } else {
                                        modeStyle.color = layer.specialEffect === 'gradient' ? 'transparent' : layer.textColor;
                                        if (layer.specialEffect === 'gradient') {
                                            modeStyle.backgroundImage = `linear-gradient(${layer.effectAngle}deg, ${layer.textColor}, ${layer.effectColor})`;
                                            modeStyle.backgroundClip = 'text';
                                            modeStyle.WebkitBackgroundClip = 'text';
                                            modeStyle.WebkitTextFillColor = 'transparent';
                                        }
                                }
                           }
                           
                           if (hasExplicitShadow) {
                               modeStyle.textShadow = extraStyle.textShadow;
                           }
                      }

                      // --- PATH TEXT ---
                      if (layer.pathPoints.length > 0) {
                          const ctx = textCanvasRef.current?.getContext('2d');
                          if (!ctx) return null;
                          
                          ctx.font = constructCanvasFont(layer, fontSizePx);
                          if (ctx.canvas) {
                              ctx.canvas.style.fontVariationSettings = variationSettings;
                              ctx.canvas.style.letterSpacing = '0px';
                          }

                          const layout = calculatePathLayout(ctx, layer, fontSizePx);
                          
                          return (
                              <div style={{ ...modeStyle, width: '100%', height: '100%', left: 0, top: 0, letterSpacing: '0px' }}>
                                  {layout.map((item, i) => (
                                      <div 
                                        key={i}
                                        style={{
                                            position: 'absolute',
                                            left: `${item.x}px`,
                                            top: `${item.y}px`,
                                            transform: `translate(-50%, -50%) rotate(${item.r}deg)`,
                                            whiteSpace: 'pre',
                                            letterSpacing: '0px' // Force reset spacing for path characters
                                        }}
                                      >
                                          {item.char === ' ' ? '\u00A0' : item.char}
                                      </div>
                                  ))}
                              </div>
                          );
                      }

                      // --- STANDARD TEXT ---
                      const xPct = layer.overlayPosition.x;
                      const yPct = layer.overlayPosition.y;

                      const textToRender = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
                      const lines = textToRender.split('\n');

                      const standardTransform = `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`;
                      const finalTransform = extraStyle?.transform || standardTransform;

                      return (
                          <div 
                              style={{
                                  ...modeStyle,
                                  left: `${xPct}%`,
                                  top: `${yPct}%`,
                                  transform: finalTransform,
                                  transformOrigin: 'center center',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: layer.textAlign === 'center' ? 'center' : layer.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                  minWidth: '10px',
                                  textAlign: layer.textAlign,
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
                  };

                  // --- RENDER PASSES ---
                  const renderShadow = () => {
                      if (!layer.hasShadow || !isShadowSupported(layer.fontFamily)) return null;
                      return renderContent('fill', {
                          color: 'transparent',
                          WebkitTextFillColor: 'transparent',
                          WebkitTextStroke: '0px transparent',
                          backgroundImage: 'none',
                          textShadow: shadowString,
                          zIndex: 1,
                          mixBlendMode: 'normal'
                      });
                  }

                  const renderEchoes = () => {
                      if (layer.specialEffect !== 'echo') return null;
                      const echoCount = 5;
                      const angleRad = (layer.effectAngle * Math.PI) / 180;
                      const distanceStep = layer.effectIntensity * (imgDims.w * 0.0005);
                      
                      const echoes = [];
                      for (let i = echoCount; i >= 1; i--) {
                            const dx = Math.cos(angleRad) * distanceStep * i;
                            const dy = Math.sin(angleRad) * distanceStep * i;
                            const alpha = 0.5 * (1 - i/echoCount);
                            
                            echoes.push(
                                <React.Fragment key={`echo-${i}`}>
                                {renderContent('fill', {
                                    transform: layer.pathPoints.length > 0 
                                       ? `translate(${dx}px, ${dy}px)` 
                                       : `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1}) translate(${dx}px, ${dy}px)`,
                                    color: layer.textColor,
                                    opacity: alpha, // Use local alpha, global opacity handled by wrapper
                                    textShadow: 'none', 
                                    zIndex: 2,
                                    pointerEvents: 'none',
                                    mixBlendMode: 'normal'
                                })}
                                </React.Fragment>
                            );
                      }
                      return <>{echoes}</>;
                  }

                  const renderGlitch = () => {
                      if (layer.specialEffect !== 'glitch') return null;
                      
                      const offsetBase = (layer.effectIntensity / 100) * (fontSizePx * 0.2);
                      const angleRad = (layer.effectAngle * Math.PI) / 180;
                      const glitchBlend = (!layer.isRainbowGlitch || layer.isRainbowLights) ? 'screen' as const : 'normal' as const;

                      const cloneResetStyle = {
                          textShadow: 'none',
                          WebkitTextStroke: '0px transparent', 
                          WebkitTextFillColor: 'currentColor', 
                          backgroundImage: 'none', 
                          mixBlendMode: glitchBlend
                      };

                      if (layer.isRainbowGlitch) {
                            const rainbowColors = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#8f00ff', '#4b0082'];
                            const spreadFactor = 3.0;
                            return (
                                <>
                                    {rainbowColors.map((color, i) => {
                                        const indexOffset = i - (rainbowColors.length - 1) / 2;
                                        const dist = (indexOffset * offsetBase * spreadFactor) / 2;
                                        const dx = Math.cos(angleRad) * dist;
                                        const dy = Math.sin(angleRad) * dist;

                                        return (
                                            <React.Fragment key={`rainbow-${i}`}>
                                            {renderContent('fill', {
                                                transform: layer.pathPoints.length > 0 
                                                ? `translate(${dx}px, ${dy}px)` 
                                                : `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1}) translate(${dx}px, ${dy}px)`,
                                                color: color,
                                                zIndex: 3, 
                                                opacity: layer.rainbowOpacity,
                                                filter: `blur(${layer.rainbowBlur}px)`,
                                                pointerEvents: 'none',
                                                ...cloneResetStyle
                                            })}
                                            </React.Fragment>
                                        );
                                    })}
                                </>
                            );
                        } else {
                            const dx = Math.cos(angleRad) * offsetBase;
                            const dy = Math.sin(angleRad) * offsetBase;
                            return (
                                <>
                                    {renderContent('fill', {
                                        transform: layer.pathPoints.length > 0 
                                           ? `translate(${-dx}px, ${-dy}px)` 
                                           : `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1}) translate(${-dx}px, ${-dy}px)`,
                                        color: layer.effectColor,
                                        zIndex: 3,
                                        opacity: 1,
                                        filter: 'blur(1px)',
                                        pointerEvents: 'none',
                                        ...cloneResetStyle
                                    })}
                                    {renderContent('fill', {
                                        transform: layer.pathPoints.length > 0 
                                           ? `translate(${dx}px, ${dy}px)` 
                                           : `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1}) translate(${dx}px, ${dy}px)`,
                                        color: layer.effectColor2,
                                        zIndex: 3,
                                        opacity: 1,
                                        filter: 'blur(1px)',
                                        pointerEvents: 'none',
                                        ...cloneResetStyle
                                    })}
                                </>
                            );
                        }
                  }

                  return (
                    <div key={layer.id} style={wrapperStyle}>
                        {renderShadow()}
                        {renderEchoes()}
                        {renderGlitch()}
                        
                        {/* Main Layer */}
                        {layer.hasOutline && renderContent('outline', { zIndex: 4 })}
                        {renderContent('fill', { zIndex: 4 })}
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
                    if (looseMatch && looseMatch[1]) {
                        loadUrlImage(looseMatch[1]);
                    }
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
            <div 
                className="relative w-full h-full overflow-hidden rounded-[3px] shadow-2xl bg-neutral-900 flex items-center justify-center"
                style={{ backgroundColor: design.backgroundType === 'solid' ? design.backgroundColor : undefined }}
            >
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

                {/* DOM OVERLAY FOR ALL TEXT LAYERS (Standard + Path) */}
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