
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { AspectRatio } from '../types';

interface CropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onConfirm: (croppedDataUrl: string, ratio: AspectRatio) => void;
}

const CropModal: React.FC<CropModalProps> = ({ isOpen, imageSrc, onClose, onConfirm }) => {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('1:1');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Smart Initialization when image loads
  useEffect(() => {
    if (isOpen && imageSrc) {
        const img = new Image();
        img.onload = () => {
            const r = img.width / img.height;
            
            // Attempt to guess closest ratio to prepopulate
            if (Math.abs(r - 1) < 0.2) setSelectedRatio('1:1');
            else if (Math.abs(r - 4/3) < 0.2) setSelectedRatio('4:3');
            else if (Math.abs(r - 3/2) < 0.2) setSelectedRatio('3:2');
            else if (Math.abs(r - 16/9) < 0.2) setSelectedRatio('16:9');
            else setSelectedRatio('1:1'); // Fallback

            setZoom(1);
            setPan({ x: 0, y: 0 });
        };
        img.src = imageSrc;
    }
  }, [isOpen, imageSrc]);

  // Calculate target numeric aspect ratio based on current selection
  const getTargetRatio = () => {
    const [w, h] = selectedRatio.split(':').map(Number);
    return w / h;
  };

  // Helper: Constrain Pan to keep image covering the crop area
  const constrainPan = useCallback((currentPan: {x: number, y: number}, currentZoom: number) => {
      if (!containerRef.current || !imageRef.current) return currentPan;
      
      const ratio = getTargetRatio();
      const container = containerRef.current.getBoundingClientRect();
      const padding = 40; 
      const maxWidth = container.width - padding;
      const maxHeight = container.height - padding;
      
      // Determine Crop Box Size (Visual)
      let cropW, cropH;
      if (maxWidth / maxHeight < ratio) {
        cropW = maxWidth;
        cropH = maxWidth / ratio;
      } else {
        cropH = maxHeight;
        cropW = maxHeight * ratio;
      }

      // Determine Image Size (Visual)
      const img = imageRef.current;
      const naturalRatio = img.naturalWidth / img.naturalHeight;
      
      let baseW, baseH;
      // Logic: "Cover" the crop box
      if (naturalRatio > ratio) {
          baseH = cropH;
          baseW = baseH * naturalRatio;
      } else {
          baseW = cropW;
          baseH = baseW / naturalRatio;
      }

      const actualW = baseW * currentZoom;
      const actualH = baseH * currentZoom;

      // Calculate max allowable pan
      // (Actual Dimension - Crop Dimension) / 2
      const maxPanX = Math.max(0, (actualW - cropW) / 2);
      const maxPanY = Math.max(0, (actualH - cropH) / 2);

      return {
          x: Math.max(-maxPanX, Math.min(maxPanX, currentPan.x)),
          y: Math.max(-maxPanY, Math.min(maxPanY, currentPan.y))
      };

  }, [selectedRatio]);

  // Re-constrain when parameters change
  useEffect(() => {
      setPan(p => constrainPan(p, zoom));
  }, [zoom, selectedRatio, constrainPan]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newRawPan = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
    };
    setPan(constrainPan(newRawPan, zoom));
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleConfirm = () => {
      if (!imageRef.current) return;
      const img = imageRef.current;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const targetRatio = getTargetRatio();
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const naturalRatio = naturalW / naturalH;

      // Determine the "Visible Viewport" in natural pixels
      // We need to reverse map the Pan/Zoom logic.
      
      // 1. Calculate dimensions of the "Cover" rect in natural pixels at zoom 1
      let coverW, coverH;
      if (naturalRatio > targetRatio) {
          // Image is wider. Height fits exactly.
          coverH = naturalH;
          coverW = naturalH * naturalRatio; // actually just naturalW
      } else {
          // Image is taller. Width fits exactly.
          coverW = naturalW;
          coverH = naturalW / naturalRatio; // actually just naturalH
      }

      // 2. Apply Zoom: The "Visible Area" shrinks as zoom increases
      // Visible Width = (Crop Width in Natural Pixels) / Zoom ? 
      // Let's think about the Crop Box size relative to Natural Image.
      
      let visibleW, visibleH;
      
      if (naturalRatio > targetRatio) {
          // Image constrained by height initially.
          // Crop Box Height = Natural Height / Zoom
          visibleH = naturalH / zoom;
          visibleW = visibleH * targetRatio;
      } else {
          // Image constrained by width initially.
          visibleW = naturalW / zoom;
          visibleH = visibleW / targetRatio;
      }

      // 3. Apply Pan
      // Pan is stored in visual pixels. We need to convert to % shift then to natural pixels.
      // Let's get the Visual scale factor.
      const container = containerRef.current?.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      // Scale = Natural / Visual
      const scaleFactor = naturalW / imgRect.width;
      
      // Pan moves the image. A positive Pan X means Image moved Right -> Visible Area moves Left.
      // Center of Visible Area relative to Image Center:
      const shiftX = -pan.x * scaleFactor;
      const shiftY = -pan.y * scaleFactor;

      const startX = (naturalW - visibleW) / 2 + shiftX;
      const startY = (naturalH - visibleH) / 2 + shiftY;

      // 4. Output Resolution (High Quality)
      // Let's use the visible resolution, capped nicely? Or just mapping.
      canvas.width = visibleW;
      canvas.height = visibleH;
      
      ctx.drawImage(
          img,
          startX, startY, visibleW, visibleH, // Source Crop
          0, 0, visibleW, visibleH // Destination
      );
      
      onConfirm(canvas.toDataURL('image/jpeg', 0.95), selectedRatio);
      onClose();
  };

  if (!isOpen || !imageSrc) return null;

  const visualRatio = getTargetRatio();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full h-full max-w-6xl max-h-screen p-4 md:p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
                <h2 className="text-xl font-bold text-white">Crop Image</h2>
                <p className="text-xs text-neutral-400">Adjust your upload to fit standard formats</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white">
                <X size={24} />
            </button>
        </div>

        {/* Workspace */}
        <div className="flex-1 relative bg-neutral-900 rounded-[3px] overflow-hidden border border-neutral-800 flex items-center justify-center">
             <div 
                ref={containerRef}
                className="absolute inset-0 cursor-move z-10 flex items-center justify-center overflow-hidden select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
             >
                {/* Crop Overlay (The Window) */}
                <div 
                    style={{
                        aspectRatio: `${visualRatio}`,
                        width: visualRatio >= 1 ? '80%' : 'auto',
                        height: visualRatio < 1 ? '80%' : 'auto',
                        maxHeight: '80%',
                        maxWidth: '80%',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.85)', // The dark overlay
                    }}
                    className="relative z-20 pointer-events-none ring-1 ring-white/50 rounded-[1px]"
                >
                    {/* Grid */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20">
                        <div className="border-r border-white/50 h-full w-full row-span-3 col-start-1"></div>
                        <div className="border-r border-white/50 h-full w-full row-span-3 col-start-2"></div>
                        <div className="border-b border-white/50 w-full h-full col-span-3 row-start-1"></div>
                        <div className="border-b border-white/50 w-full h-full col-span-3 row-start-2"></div>
                    </div>
                </div>

                {/* The Image */}
                <img 
                    ref={imageRef}
                    src={imageSrc}
                    alt="Crop Target"
                    draggable={false}
                    className="absolute transition-transform duration-75 ease-linear origin-center max-w-none max-h-none"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        // Initial sizing to Ensure "Cover"
                        // We simply set it to match the container's min dimension to start?
                        // Actually, simpler to use the "Cover" logic:
                        minWidth: visualRatio >= 1 ? '80%' : 'auto',
                        minHeight: visualRatio < 1 ? '80%' : 'auto',
                    }}
                />
             </div>
        </div>

        {/* Controls Footer */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
            
            {/* Aspect Ratios */}
            <div className="flex items-center gap-2 bg-neutral-900 p-2 rounded-[3px] border border-neutral-800">
                {(['1:1', '4:3', '3:2', '16:9'] as AspectRatio[]).map(r => (
                    <button
                        key={r}
                        onClick={() => setSelectedRatio(r)}
                        className={`flex-1 py-2 text-xs font-bold rounded-[2px] transition-colors ${selectedRatio === r ? 'bg-neutral-800 text-pink-500 border-b-2 border-pink-500' : 'text-neutral-500 hover:text-white'}`}
                    >
                        {r}
                    </button>
                ))}
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-4 bg-neutral-900 p-2 rounded-[3px] border border-neutral-800 px-4">
                 <div className="flex-1 flex items-center gap-3">
                     <ZoomOut size={14} className="text-neutral-500" />
                     <input 
                        type="range" min="1" max="3" step="0.01"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                     />
                     <ZoomIn size={14} className="text-neutral-500" />
                 </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button 
                    onClick={onClose}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-[3px] transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleConfirm}
                    className="flex-1 bg-gradient-to-r from-pink-600 to-violet-600 hover:brightness-110 text-white font-bold rounded-[3px] transition-all shadow-lg shadow-pink-900/20 flex items-center justify-center gap-2"
                >
                    <Check size={16} />
                    Apply Crop
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default CropModal;
