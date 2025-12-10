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

// --- Render Logic Helpers ---

/**
 * Generates all CSS styles needed for effects (Shadow, Echo, Gradient, Outline).
 * Note: Glitch is handled structurally now, so we removed it from here to avoid text-shadow duplication.
 */
const generateLayerStyles = (layer: TextLayer, fontSizePx: number, width: number) => {
    const styles: any = {};
    const shadows: string[] = [];

    // 1. Standard Shadow
    if (layer.hasShadow) {
        const angleRad = (layer.shadowAngle * Math.PI) / 180;
        const shadowDist = (layer.shadowOffset / 100) * fontSizePx;
        const sX = shadowDist * Math.cos(angleRad);
        const sY = shadowDist * Math.sin(angleRad);
        const sBlur = (layer.shadowBlur / 100) * fontSizePx * 2;
        const sColor = hexToRgba(layer.shadowColor, layer.shadowOpacity ?? 1);
        shadows.push(`${sX}px ${sY}px ${sBlur}px ${sColor}`);
    }

    // 2. Echo Effect
    if (layer.specialEffect === 'echo') {
        const echoCount = 5;
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        const distanceStep = layer.effectIntensity * (width * 0.0005); 
        const baseAlpha = 0.5;

        for (let i = 1; i <= echoCount; i++) {
             const dx = Math.cos(angleRad) * distanceStep * i;
             const dy = Math.sin(angleRad) * distanceStep * i;
             // We use the text color but fade it out
             const alpha = baseAlpha * (1 - i/echoCount);
             shadows.push(`${dx}px ${dy}px 0px ${hexToRgba(layer.textColor, alpha)}`);
        }
    }

    // Apply Text Shadows
    if (shadows.length > 0) {
        styles.textShadow = shadows.join(', ');
    } else {
        styles.textShadow = 'none';
    }

    // 3. Gradient Fill
    if (layer.specialEffect === 'gradient' && !layer.isHollow) {
        styles.backgroundImage = `linear-gradient(${layer.effectAngle}deg, ${layer.textColor}, ${layer.effectColor})`;
        styles.backgroundClip = 'text';
        styles.WebkitBackgroundClip = 'text';
        styles.color = 'transparent';
        styles.WebkitTextFillColor = 'transparent';
    } else {
        styles.color = layer.textColor;
    }

    // 4. Hollow / Outline
    if (layer.isHollow) {
        styles.color = 'transparent';
        styles.WebkitTextFillColor = 'transparent';
        styles.backgroundImage = 'none'; // Ensure no gradient on hollow
        
        styles.WebkitTextStroke = `${layer.hasOutline ? layer.outlineWidth : 2}px ${layer.hasOutline ? layer.outlineColor : layer.textColor}`;
    } else if (layer.hasOutline) {
        styles.WebkitTextStroke = `${layer.outlineWidth}px ${layer.outlineColor}`;
    }

    return styles;
};

// Helper: Calculate Path Character Positions
const calculatePathLayout = (ctx: CanvasRenderingContext2D, layer: TextLayer, width: number, height: number) => {
    const fontSizePx = (layer.textSize / 100) * width;
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
    let fontWeight = layer.isBold ? 700 : 400;
    if (layer.fontVariations?.['wght']) fontWeight = Math.round(layer.fontVariations['wght']);
    let stretch = "normal";
    if (layer.fontVariations?.['wdth']) stretch = `${Math.round(layer.fontVariations['wdth'])}%`;
    ctx.font = `${layer.isItalic ? 'italic' : 'normal'} normal ${fontWeight} ${stretch} ${fontSizePx}px/1 "${layer.fontFamily}"`;

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
                rotation: finalRotation
            });
        }
        currentDist += charW + scaledLetterSpacing;
    }
    return layout;
};


const constructCanvasFont = (layer: TextLayer, width: number): string => {
    const fontSize = (layer.textSize / 100) * width;
    const fontFamily = `"${layer.fontFamily}"`;
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
        if (slnt !== 0) style = `oblique ${Math.abs(slnt)}deg`;
    }
    return `${style} normal ${weight} ${stretch} ${fontSize}px/1 ${fontFamily}`;
};

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
 * Supports both Standard and Path-based text, and Glitch reconstruction.
 */
const createTextSVG = (layer: TextLayer, width: number, height: number, ctx: CanvasRenderingContext2D): string => {
    const fontSizePx = (layer.textSize / 100) * width;
    const fontFamily = `"${layer.fontFamily}"`;
    
    const fontWeight = layer.fontVariations?.['wght'] ? Math.round(layer.fontVariations['wght']) : (layer.isBold ? 700 : 400);
    let fontStyle = layer.isItalic ? 'italic' : 'normal';
    if (layer.fontVariations?.['slnt']) fontStyle = `oblique ${Math.abs(layer.fontVariations['slnt'])}deg`;
    
    const variationSettings = getFontVariationSettings(layer);
    
    // Generate Styles (Effects, Shadows, Gradients)
    const effectStyles = generateLayerStyles(layer, fontSizePx, width);
    const hasTextShadow = !!effectStyles.textShadow && effectStyles.textShadow !== 'none';
    
    const styleObjToString = (styles: any) => Object.entries(styles).map(([k, v]) => {
        const kebabKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebabKey}: ${v};`;
    }).join(' ');

    const baseStyleString = styleObjToString(effectStyles);

    // Common Text Generation Logic (Standard vs Path)
    const generateContentHTML = (extraStyles: string = '') => {
        if (layer.pathPoints.length > 0) {
            const layout = calculatePathLayout(ctx, layer, width, height);
            return layout.map(item => `
                <div style="
                    position: absolute;
                    left: ${item.x}px;
                    top: ${item.y}px;
                    transform: translate(-50%, -50%) rotate(${item.rotation}deg);
                    white-space: pre;
                    ${extraStyles}
                ">${item.char === ' ' ? '&nbsp;' : item.char}</div>
            `).join('');
        } else {
            const text = layer.isUppercase ? layer.textOverlay.toUpperCase() : layer.textOverlay;
            const lines = text.split('\n');
            const innerContent = lines.map(line => {
                const charSpans = line.split('').map(char => {
                    const charDisplay = char === ' ' ? '&nbsp;' : char;
                    const transform = layer.letterRotation !== 0 ? `transform: rotate(${layer.letterRotation}deg); display: inline-block;` : 'display: inline-block;';
                    return `<span style="${transform}">${charDisplay}</span>`;
                }).join('');
                return `<div style="white-space: pre; display: block;">${charSpans}</div>`;
            }).join('');
            
            return `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: ${layer.textAlign === 'center' ? 'center' : layer.textAlign === 'right' ? 'flex-end' : 'flex-start'};
                    text-align: ${layer.textAlign};
                    width: 100%;
                    ${extraStyles}
                ">
                    ${innerContent}
                </div>
            `;
        }
    };

    let innerHTML = '';

    // GLITCH LOGIC: Split into Shadow Pass, Clones, and Main Text
    if (layer.specialEffect === 'glitch') {
        const offsetBase = (layer.effectIntensity / 100) * (fontSizePx * 0.2); 
        const angleRad = (layer.effectAngle * Math.PI) / 180;
        
        // 1. Shadow Pass (Bottom Layer)
        // Renders only the shadow, with transparent text
        if (hasTextShadow) {
             const shadowStyle = `
                color: transparent;
                -webkit-text-fill-color: transparent;
                -webkit-text-stroke: 0px transparent;
                background-image: none;
                mix-blend-mode: normal; 
             `;
             // Reuse baseStyleString but override to make text transparent
             innerHTML += `<div style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none;">${generateContentHTML(shadowStyle)}</div>`;
        }

        // 2. Clones (Middle Layers)
        // Renders the glitch colors, NO shadow, Blending depends on lights toggle
        // FIX: Always use screen for Standard Glitch, use toggle for Rainbow Glitch
        const cloneResetStyle = `
            text-shadow: none;
            -webkit-text-stroke: 0px transparent;
            -webkit-text-fill-color: currentColor;
            background-image: none;
            mix-blend-mode: ${(!layer.isRainbowGlitch || layer.isRainbowLights) ? 'screen' : 'normal'}; 
        `;

        const createClone = (color: string, offsetX: number, offsetY: number, opacity: number, blur: number) => {
            return `<div style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform: translate(${offsetX}px, ${offsetY}px); color: ${color}; opacity: ${opacity}; filter: blur(${blur}px); pointer-events: none; ${cloneResetStyle}">${generateContentHTML()}</div>`;
        };

        if (layer.isRainbowGlitch) {
            // Updated Rainbow Colors: Red, Orange, Yellow, Green, Cyan, Blue, Violet, Indigo (Last)
            const rainbowColors = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#8f00ff', '#4b0082'];
            const spreadFactor = 3.0; // Doubled spread from 1.5
            rainbowColors.forEach((color, i) => {
                const indexOffset = i - (rainbowColors.length - 1) / 2; 
                const dist = (indexOffset * offsetBase * spreadFactor) / 2;
                const dx = Math.cos(angleRad) * dist;
                const dy = Math.sin(angleRad) * dist;
                innerHTML += createClone(color, dx, dy, layer.rainbowOpacity, layer.rainbowBlur);
            });
        } else {
            const dx = Math.cos(angleRad) * offsetBase;
            const dy = Math.sin(angleRad) * offsetBase;
            innerHTML += createClone(layer.effectColor, -dx, -dy, 1, 1);
            innerHTML += createClone(layer.effectColor2, dx, dy, 1, 1);
        }
        
        // 3. Main Text (Top Layer)
        // Renders text/gradient/outline, NO shadow
        const mainStyleNoShadow = `text-shadow: none;`;
        innerHTML += `<div style="position: relative; width: 100%; height: 100%;">${generateContentHTML(mainStyleNoShadow)}</div>`;

    } else {
        // Standard Render (Shadow, Text, etc all in one)
        innerHTML = generateContentHTML();
    }

    // Positioning Wrapper Logic
    let wrapperStyle = '';
    if (layer.pathPoints.length > 0) {
        wrapperStyle = `width: 100%; height: 100%; position: absolute; left: 0; top: 0;`;
    } else {
        const xPct = layer.overlayPosition.x;
        const yPct = layer.overlayPosition.y;
        wrapperStyle = `
            position: absolute;
            left: ${xPct}%;
            top: ${yPct}%;
            transform: translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1});
            transform-origin: center center;
            width: 100%;
        `;
    }

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="
                width: 100%;
                height: 100%;
                position: relative;
                overflow: visible;
                background: transparent;
                font-family: ${fontFamily};
                font-size: ${fontSizePx}px;
                font-weight: ${fontWeight};
                font-style: ${fontStyle};
                font-variation-settings: ${variationSettings};
                line-height: 1;
                letter-spacing: ${layer.letterSpacing * (fontSizePx/50)}px;
                font-synthesis: none;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                mix-blend-mode: ${layer.blendMode};
                ${baseStyleString}
            ">
                <div style="${wrapperStyle}">
                    ${innerHTML}
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

      // 1. Render Background
      const bgImg = overrideBgImage || bgImageRef.current;
      bufferCtx.clearRect(0, 0, width, height);
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
          
          // In Preview mode, the DOM Overlay handles all text rendering (Standard + Path)
          // except for the actual interactive drawing of the pink path line.
          // This ensures perfect WYSIWYG between editing and export.
          if (isPreview && !forceUseCanvas) {
              // Skip visual rendering here, let DOM handle it.
          } else {
              // EXPORT MODE or Fallback
              // Always try to use SVG Renderer first because it supports Variable Fonts and Effects best.
              const svgData = createTextSVG(layer, width, height, scratchCtx); // Pass scratchCtx for measuring path text
              
              const img = new Image();
              const loadPromise = new Promise<boolean>((resolve) => {
                  img.onload = () => resolve(true);
                  img.onerror = () => resolve(false);
                  img.src = svgData;
              });

              // Race timeout
              const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500));
              const isLoaded = await Promise.race([loadPromise, timeoutPromise]);
              
              if (isLoaded) {
                  scratchCtx.drawImage(img, 0, 0);
              } else {
                  console.warn("SVG Render failed for layer", layer.id);
              }
          }

          // Composite Scratch to Buffer
          bufferCtx.save();
          bufferCtx.setTransform(1, 0, 0, 1, 0, 0); 
          
          // Blend Mode Logic for Export
          // Note: SVG foreignObject handles mix-blend-mode internally for the text elements (glitch, etc)
          // But to blend the entire layer with the background, we use Canvas composite operations.
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

  // --- DOM Overlay Renderer ---
  // Now handles BOTH Standard and Path text to ensure Variable Font + Effects support
  const renderTextLayersOverlay = () => {
      if (!imgDims) return null;

      // Filter visible layers
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
                  
                  // Explicit Font Properties
                  const fontWeight = layer.fontVariations && layer.fontVariations['wght'] !== undefined 
                      ? Math.round(layer.fontVariations['wght']) 
                      : (layer.isBold ? 700 : 400);
                  
                  let fontStyle = layer.isItalic ? 'italic' : 'normal';
                  if (layer.fontVariations && layer.fontVariations['slnt'] !== undefined && layer.fontVariations['slnt'] !== 0) {
                      fontStyle = `oblique ${Math.abs(layer.fontVariations['slnt'])}deg`;
                  }

                  // Generate Advanced CSS Styles (Gradients, Echo, etc.)
                  const effectStyles = generateLayerStyles(layer, fontSizePx, imgDims.w);
                  const hasTextShadow = !!effectStyles.textShadow && effectStyles.textShadow !== 'none';

                  // Base container style
                  const baseStyle: React.CSSProperties = {
                      position: 'absolute',
                      fontFamily: `"${layer.fontFamily}"`,
                      fontSize: `${fontSizePx}px`,
                      fontWeight: fontWeight,
                      fontStyle: fontStyle,
                      fontVariationSettings: variationSettings,
                      lineHeight: 1.0,
                      letterSpacing: `${layer.letterSpacing * (fontSizePx/50)}px`,
                      fontSynthesis: 'none',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      opacity: layer.opacity,
                      mixBlendMode: layer.blendMode === 'normal' ? 'normal' : layer.blendMode as any,
                      zIndex: design.layers.findIndex(l => l.id === layer.id) * 10,
                      ...effectStyles // Apply generated effects
                  };

                  // --- CONTENT RENDERER ---
                  const renderContent = (extraStyle?: React.CSSProperties) => {
                      // --- PATH TEXT ---
                      if (layer.pathPoints.length > 0) {
                          const ctx = textCanvasRef.current?.getContext('2d');
                          if (!ctx) return null;
                          const layout = calculatePathLayout(ctx, layer, imgDims.w, imgDims.h);
                          
                          return (
                              <div style={{ ...baseStyle, width: '100%', height: '100%', left: 0, top: 0, ...extraStyle }}>
                                  {layout.map((item, i) => (
                                      <div 
                                        key={i}
                                        style={{
                                            position: 'absolute',
                                            left: `${item.x}px`,
                                            top: `${item.y}px`,
                                            transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                                            whiteSpace: 'pre'
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

                      return (
                          <div 
                              style={{
                                  ...baseStyle,
                                  left: `${xPct}%`,
                                  top: `${yPct}%`,
                                  transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
                                  transformOrigin: 'center center',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: layer.textAlign === 'center' ? 'center' : layer.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                  minWidth: '10px',
                                  textAlign: layer.textAlign,
                                  ...extraStyle
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

                  // --- GLITCH COMPOSITOR ---
                  if (layer.specialEffect === 'glitch') {
                      const offsetBase = (layer.effectIntensity / 100) * (fontSizePx * 0.2);
                      const angleRad = (layer.effectAngle * Math.PI) / 180;
                      
                      const cloneResetStyle = {
                          textShadow: 'none',
                          WebkitTextStroke: '0px transparent', // Explicitly remove outline
                          WebkitTextFillColor: 'currentColor', // Force fill to current color
                          backgroundImage: 'none', // Remove gradient
                          mixBlendMode: (!layer.isRainbowGlitch || layer.isRainbowLights) ? 'screen' as const : 'normal' as const
                      };

                      // Styles for Main Text when Glitching
                      const mainStyleNoShadow = {
                          textShadow: 'none'
                      };

                      const renderClones = () => {
                        if (layer.isRainbowGlitch) {
                            // Updated Rainbow Colors: Red, Orange, Yellow, Green, Cyan, Blue, Violet, Indigo (Last)
                            const rainbowColors = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#8f00ff', '#4b0082'];
                            const spreadFactor = 3.0; // Doubled spread from 1.5
                            
                            return (
                                <>
                                    {rainbowColors.map((color, i) => {
                                        // Dynamic centering offset based on array length
                                        const indexOffset = i - (rainbowColors.length - 1) / 2;
                                        const dist = (indexOffset * offsetBase * spreadFactor) / 2;
                                        const dx = Math.cos(angleRad) * dist;
                                        const dy = Math.sin(angleRad) * dist;

                                        return (
                                            <React.Fragment key={i}>
                                            {renderContent({
                                                transform: layer.pathPoints.length > 0 
                                                ? `translate(${dx}px, ${dy}px)` 
                                                : `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
                                                color: color,
                                                zIndex: (design.layers.findIndex(l => l.id === layer.id) * 10) + 2, // Layer + 2
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
                            // STANDARD MODE: 2 Clones (Red/Blue or custom)
                            const dx = Math.cos(angleRad) * offsetBase;
                            const dy = Math.sin(angleRad) * offsetBase;
                            
                            return (
                                <>
                                    {/* Clone 1 (Left/Negative) */}
                                    {renderContent({
                                        transform: layer.pathPoints.length > 0 
                                           ? `translate(${-dx}px, ${-dy}px)` 
                                           : `translate(calc(-50% - ${dx}px), calc(-50% - ${dy}px)) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
                                        color: layer.effectColor,
                                        zIndex: (design.layers.findIndex(l => l.id === layer.id) * 10) + 2, // Layer + 2
                                        opacity: 1,
                                        filter: 'blur(1px)',
                                        pointerEvents: 'none',
                                        ...cloneResetStyle
                                    })}

                                    {/* Clone 2 (Right/Positive) */}
                                    {renderContent({
                                        transform: layer.pathPoints.length > 0 
                                           ? `translate(${dx}px, ${dy}px)` 
                                           : `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${layer.rotation}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
                                        color: layer.effectColor2,
                                        zIndex: (design.layers.findIndex(l => l.id === layer.id) * 10) + 2, // Layer + 2
                                        opacity: 1,
                                        filter: 'blur(1px)',
                                        pointerEvents: 'none',
                                        ...cloneResetStyle
                                    })}
                                </>
                            );
                        }
                      };

                      return (
                          <React.Fragment key={layer.id}>
                                {/* 1. Shadow Pass (Bottom) */}
                                {hasTextShadow && renderContent({
                                    color: 'transparent',
                                    WebkitTextFillColor: 'transparent',
                                    WebkitTextStroke: '0px transparent',
                                    backgroundImage: 'none',
                                    zIndex: (design.layers.findIndex(l => l.id === layer.id) * 10) + 1, // Layer + 1
                                    mixBlendMode: 'normal' // Shadows handle their own blending via rgba
                                })}

                                {/* 2. Clones (Middle) */}
                                {renderClones()}

                                {/* 3. Main Channel (Top) */}
                                {renderContent({
                                    zIndex: (design.layers.findIndex(l => l.id === layer.id) * 10) + 3, // Layer + 3
                                    ...mainStyleNoShadow
                                })}
                          </React.Fragment>
                      );
                  }

                  // Normal Render
                  return <React.Fragment key={layer.id}>{renderContent()}</React.Fragment>;
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