
import React, { useState, useRef } from 'react';
import Canvas, { CanvasHandle } from './components/Canvas';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import { DesignState, AppSettings, AspectRatio, Orientation, Point } from './types';
import { generateBackgroundImage, editImage } from './services/geminiService';

// Initial State
const DEFAULT_DESIGN: DesignState = {
  prompt: '',
  aspectRatio: '1:1',
  orientation: 'landscape',
  textOverlay: 'EDIT ME',
  fontFamily: 'Inter',
  textColor: '#FFFFFF',
  shadowColor: '#000000',
  textSize: 5,
  letterSpacing: 0, // Default kerning
  letterRotation: 0, // Default letter rotation
  textAlign: 'center',
  overlayPosition: { x: 50, y: 50 },
  blendMode: 'normal',
  opacity: 1,
  
  // Path
  pathPoints: [],
  pathSmoothing: 5, // Default light smoothing
  isPathInputMode: false,
  isPathMoveMode: false,

  // Blurs
  shadowBlur: 20,
  hasShadow: true,
  shadowOffset: 20,
  shadowAngle: 45,
  // Modifiers
  isBold: false,
  isItalic: false,
  isUppercase: false,
  // Effects
  isHollow: false,
  hasOutline: false,
  outlineWidth: 2,
  outlineColor: '#000000',
  // Special FX
  specialEffect: 'none',
  effectIntensity: 50,
  effectColor: '#FF0000',
  effectColor2: '#00FFFF',
  isRainbowGlitch: false,
  rainbowOpacity: 1.0,
  rainbowBlur: 0,
  effectAngle: 90,
  // Transforms
  rotation: 360,
  flipX: false,
  flipY: false
};

const DEFAULT_SETTINGS: AppSettings = {
  enableZoom: true
};

interface ImageHistoryItem {
  src: string;
  aspectRatio: AspectRatio;
  orientation: Orientation;
}

export default function App() {
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBlankConfirmOpen, setIsBlankConfirmOpen] = useState(false);
  const [isGenerateConfirmOpen, setIsGenerateConfirmOpen] = useState(false);
  
  // Image State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [isGenerating, setIsGenerating] = useState(false);
  
  const canvasRef = useRef<CanvasHandle>(null);

  // History Management
  const addToHistory = (newImageSrc: string, ratio: AspectRatio, orientation: Orientation) => {
    const newItem: ImageHistoryItem = { src: newImageSrc, aspectRatio: ratio, orientation };
    
    // Slice if we are in middle of history
    const currentHistory = imageHistory.slice(0, historyIndex + 1);
    const newHistory = [...currentHistory, newItem];
    
    // Limit to 10
    if (newHistory.length > 10) {
        newHistory.shift();
    }
    
    setImageHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setImageSrc(newImageSrc);
    // Note: We don't necessarily update design state here, the calling function usually handles that for new generations.
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const previousState = imageHistory[newIndex];
        
        setHistoryIndex(newIndex);
        setImageSrc(previousState.src);
        
        // Restore associated design constraints
        setDesign(prev => ({
            ...prev,
            aspectRatio: previousState.aspectRatio,
            orientation: previousState.orientation,
            pathPoints: [], // Clear paths on undo/redo to avoid mismatches
            isPathInputMode: false,
            isPathMoveMode: false
        }));
    }
  };

  const handleRedo = () => {
      if (historyIndex < imageHistory.length - 1) {
          const newIndex = historyIndex + 1;
          const nextState = imageHistory[newIndex];
          
          setHistoryIndex(newIndex);
          setImageSrc(nextState.src);
          
          setDesign(prev => ({
            ...prev,
            aspectRatio: nextState.aspectRatio,
            orientation: nextState.orientation,
            pathPoints: [],
            isPathInputMode: false,
            isPathMoveMode: false
        }));
      }
  };

  const handleGenerate = async () => {
    if (!design.prompt) return;
    
    setIsGenerating(true);

    try {
      const imagePromise = generateBackgroundImage(design.prompt, design.aspectRatio, design.orientation);
      const imgData = await imagePromise;

      addToHistory(imgData, design.aspectRatio, design.orientation);
      
      setDesign(prev => {
        const isDefaultText = prev.textOverlay === DEFAULT_DESIGN.textOverlay;
        return {
            ...prev,
            overlayPosition: { x: 50, y: 50 },
            rotation: 360,
            flipX: false,
            flipY: false,
            pathPoints: [], // Clear path on new gen
            isPathInputMode: false,
            isPathMoveMode: false,
            textOverlay: isDefaultText ? design.prompt.substring(0, 20).toUpperCase() : prev.textOverlay,
            letterRotation: 0, // Reset letter rotation
        };
      });

    } catch (error) {
      alert("Something went wrong creating your masterpiece. Please check your API key or quota.");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateClick = () => {
    if (imageSrc) {
      setIsGenerateConfirmOpen(true);
    } else {
      handleGenerate();
    }
  };

  const handleEdit = async () => {
      if (!imageSrc || !design.prompt) return;
      
      setIsGenerating(true);
      try {
          const editedImgData = await editImage(imageSrc, design.prompt);
          // Edit maintains current aspect ratio and orientation
          addToHistory(editedImgData, design.aspectRatio, design.orientation);
      } catch (error) {
          alert("Failed to edit image. Ensure your API key is valid.");
          console.error(error);
      } finally {
          setIsGenerating(false);
      }
  };

  const executeBlankCanvas = () => {
    const canvas = document.createElement('canvas');
    
    // Use standard "2K" / 1440p class resolutions for best balance of quality and performance.
    let width = 2048;
    let height = 2048;

    const ratio = design.aspectRatio;
    const isPortrait = design.orientation === 'portrait';

    // Establish Base Dimensions (Landscape defaults)
    switch (ratio) {
        case '1:1':
            width = 2048; height = 2048;
            break;
        case '4:3':
            width = 2048; height = 1536; 
            break;
        case '3:2':
            width = 2160; height = 1440; 
            break;
        case '16:9':
            width = 2560; height = 1440; // Standard QHD Landscape
            break;
        default:
            width = 2048; height = 2048;
    }

    // Swap dimensions if Portrait (and not square) to ensure true portrait orientation
    if (isPortrait && ratio !== '1:1') {
        const temp = width;
        width = height;
        height = temp;
    }

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, width, height);
    
    const blankImgData = canvas.toDataURL('image/png');
    addToHistory(blankImgData, design.aspectRatio, design.orientation);
    
    setDesign(prev => ({
        ...prev,
        textColor: '#FFFFFF',
        shadowColor: '#000000',
        isHollow: false,
        blendMode: 'normal',
        pathPoints: [],
        isPathInputMode: false,
        isPathMoveMode: false,
        textOverlay: 'BLANK CANVAS',
        letterRotation: 0,
        rainbowOpacity: 1.0,
        rainbowBlur: 0
    }));
    setIsBlankConfirmOpen(false);
  };

  const handleBlankClick = () => {
    if (imageSrc) {
        setIsBlankConfirmOpen(true);
    } else {
        executeBlankCanvas();
    }
  };

  const handleUploadTrigger = () => {
    canvasRef.current?.triggerFileUpload();
  };

  const handleImageUpload = (file: File) => {
    // 1. Size Limit Check (25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert("File is too large. Please upload an image smaller than 25MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const result = e.target.result as string;
        
        const img = new Image();
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const imgRatio = width / height;

            // Determine Orientation based on actual dimensions
            const newOrientation: Orientation = width >= height ? 'landscape' : 'portrait';

            // Standard Ratios (Landscape values)
            const standards: { key: AspectRatio, val: number }[] = [
                { key: '1:1', val: 1 },
                { key: '4:3', val: 4/3 },
                { key: '3:2', val: 3/2 },
                { key: '16:9', val: 16/9 }
            ];

            // Normalize for comparison (always >= 1)
            const normRatio = imgRatio >= 1 ? imgRatio : 1/imgRatio;

            // Find closest standard ratio for UI display only
            let closestRatio: AspectRatio = '1:1';
            let minDiff = Infinity;
            
            standards.forEach(s => {
                const diff = Math.abs(normRatio - s.val);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestRatio = s.key;
                }
            });

            // Update State - No Cropping, accept image as is
            addToHistory(result, closestRatio, newOrientation);
            
            setDesign(prev => ({
                ...prev,
                aspectRatio: closestRatio,
                orientation: newOrientation,
                pathPoints: [],
                isPathInputMode: false,
                isPathMoveMode: false,
                letterRotation: 0
            }));
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async () => {
    if (canvasRef.current) {
      try {
        const dataUrl = await canvasRef.current.exportImage();
        
        // Convert Base64 to Blob for better large file handling
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `textrot-${Date.now()}.png`;
        link.href = url;
        
        // Append to body to ensure click works in all browsers (Firefox)
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Export failed", e);
        alert("Could not export image.");
      }
    }
  };

  const handlePathDrawn = (points: Point[]) => {
    setDesign(prev => ({
        ...prev,
        pathPoints: points,
        isPathInputMode: false // Auto-exit drawing mode after one stroke
    }));
  };

  const handleDesignUpdate = (updates: Partial<DesignState>) => {
      setDesign(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-black text-white">
      {/* Left: Canvas Area */}
      <div className="flex-1 bg-neutral-950 flex items-center justify-center p-8 relative overflow-hidden">
        <Canvas 
            ref={canvasRef}
            imageSrc={imageSrc} 
            design={design} 
            enableZoom={settings.enableZoom}
            onImageUpload={handleImageUpload}
            onPathDrawn={handlePathDrawn}
            onUpdateDesign={handleDesignUpdate}
            className="shadow-2xl ring-1 ring-white/10"
        />
      </div>

      {/* Right: Controls */}
      <div className="w-full md:w-96 h-1/2 md:h-full z-20">
        <Controls 
          design={design} 
          setDesign={setDesign}
          onGenerate={handleGenerateClick}
          onEdit={handleEdit}
          onBlank={handleBlankClick}
          onUpload={handleUploadTrigger}
          onDownload={handleDownload}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < imageHistory.length - 1}
          isGenerating={isGenerating}
          vibeReasoning={null}
          hasImage={!!imageSrc}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      {/* Confirmation Modal for Blank Canvas */}
      <ConfirmationModal
        isOpen={isBlankConfirmOpen}
        onClose={() => setIsBlankConfirmOpen(false)}
        onConfirm={executeBlankCanvas}
        title="Reset Canvas?"
        message="This will clear your current artwork and text styles. This action cannot be undone."
      />

      {/* Confirmation Modal for Generate */}
      <ConfirmationModal
        isOpen={isGenerateConfirmOpen}
        onClose={() => setIsGenerateConfirmOpen(false)}
        onConfirm={handleGenerate}
        title="Generate New Image?"
        message="This will replace your current image. Any unsaved changes will be lost."
      />
    </div>
  );
}
