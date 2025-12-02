
import React, { useState, useRef } from 'react';
import Canvas, { CanvasHandle } from './components/Canvas';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import { DesignState, AppSettings, AspectRatio, Orientation, Point, TextLayer } from './types';
import { generateBackgroundImage, editImage } from './services/geminiService';
import { useKeyboard, KeyboardShortcut } from './hooks/useKeyboard';

// Helper to create a new layer
const createLayer = (id: string, text: string = 'EDIT ME'): TextLayer => ({
  id,
  name: 'Text Layer',
  visible: true,
  locked: false,
  textOverlay: text,
  fontFamily: 'Inter',
  textColor: '#FFFFFF',
  shadowColor: '#000000',
  textSize: 5,
  letterSpacing: 0,
  letterRotation: 0,
  textAlign: 'center',
  overlayPosition: { x: 50, y: 50 },
  blendMode: 'normal',
  opacity: 1,
  
  pathPoints: [],
  pathSmoothing: 5,
  isPathInputMode: false,
  isPathMoveMode: false,

  shadowBlur: 20,
  hasShadow: true,
  shadowOffset: 20,
  shadowAngle: 45,
  shadowOpacity: 1.0,
  
  isBold: false,
  isItalic: false,
  isUppercase: false,
  
  isHollow: false,
  hasOutline: false,
  outlineWidth: 2,
  outlineColor: '#000000',
  
  specialEffect: 'none',
  effectIntensity: 50,
  effectColor: '#FF0000',
  effectColor2: '#00FFFF',
  isRainbowGlitch: false,
  rainbowOpacity: 1.0,
  rainbowBlur: 0,
  effectAngle: 90,
  
  rotation: 360,
  flipX: false,
  flipY: false
});

const INITIAL_LAYER_ID = 'layer-1';

// Initial State
const DEFAULT_DESIGN: DesignState = {
  prompt: '',
  aspectRatio: '1:1',
  orientation: 'landscape',
  layers: [createLayer(INITIAL_LAYER_ID)],
  activeLayerId: INITIAL_LAYER_ID
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
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const previousState = imageHistory[newIndex];
        
        setHistoryIndex(newIndex);
        setImageSrc(previousState.src);
        
        setDesign(prev => ({
            ...prev,
            aspectRatio: previousState.aspectRatio,
            orientation: previousState.orientation,
            // We keep layers as is during image undo, but ensure no path mode is stuck
            layers: prev.layers.map(l => ({ ...l, pathPoints: [], isPathInputMode: false, isPathMoveMode: false }))
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
            layers: prev.layers.map(l => ({ ...l, pathPoints: [], isPathInputMode: false, isPathMoveMode: false }))
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
        // Find existing text or reset? Let's reset the active layer text if it's default
        const activeLayer = prev.layers.find(l => l.id === prev.activeLayerId);
        const newText = (activeLayer && activeLayer.textOverlay === 'EDIT ME') 
            ? design.prompt.substring(0, 20).toUpperCase() 
            : (activeLayer?.textOverlay || 'EDIT ME');
            
        // Reset only the active layer transform, or keep composition?
        // Let's keep composition but reset path modes
        const newLayers = prev.layers.map(l => ({
            ...l,
            textOverlay: l.id === prev.activeLayerId ? newText : l.textOverlay,
            pathPoints: [],
            isPathInputMode: false,
            isPathMoveMode: false,
        }));

        return {
            ...prev,
            layers: newLayers
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
    let width = 2048;
    let height = 2048;

    const ratio = design.aspectRatio;
    const isPortrait = design.orientation === 'portrait';

    switch (ratio) {
        case '1:1': width = 2048; height = 2048; break;
        case '4:3': width = 2048; height = 1536; break;
        case '3:2': width = 2160; height = 1440; break;
        case '16:9': width = 2560; height = 1440; break;
        default: width = 2048; height = 2048;
    }

    if (isPortrait && ratio !== '1:1') {
        const temp = width; width = height; height = temp;
    }

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, width, height);
    
    const blankImgData = canvas.toDataURL('image/png');
    addToHistory(blankImgData, design.aspectRatio, design.orientation);
    
    const newId = crypto.randomUUID();
    setDesign(prev => ({
        ...prev,
        layers: [createLayer(newId, 'BLANK CANVAS')],
        activeLayerId: newId
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

            const newOrientation: Orientation = width >= height ? 'landscape' : 'portrait';

            const standards: { key: AspectRatio, val: number }[] = [
                { key: '1:1', val: 1 },
                { key: '4:3', val: 4/3 },
                { key: '3:2', val: 3/2 },
                { key: '16:9', val: 16/9 }
            ];

            const normRatio = imgRatio >= 1 ? imgRatio : 1/imgRatio;
            let closestRatio: AspectRatio = '1:1';
            let minDiff = Infinity;
            
            standards.forEach(s => {
                const diff = Math.abs(normRatio - s.val);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestRatio = s.key;
                }
            });

            addToHistory(result, closestRatio, newOrientation);
            
            setDesign(prev => ({
                ...prev,
                aspectRatio: closestRatio,
                orientation: newOrientation,
                layers: prev.layers.map(l => ({ ...l, pathPoints: [], isPathInputMode: false, isPathMoveMode: false }))
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
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `textrot-${Date.now()}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        
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
        layers: prev.layers.map(l => 
            l.id === prev.activeLayerId 
            ? { ...l, pathPoints: points, isPathInputMode: false }
            : l
        )
    }));
  };

  const handleDesignUpdate = (updates: Partial<DesignState>) => {
      setDesign(prev => ({ ...prev, ...updates }));
  };

  // Setup Keyboard Shortcuts (Empty for now as requested)
  // Example usage commented out:
  // const shortcuts: KeyboardShortcut[] = [
  //   { id: 'undo', combo: { key: 'z', ctrl: true }, action: handleUndo },
  //   { id: 'redo', combo: { key: 'y', ctrl: true }, action: handleRedo }
  // ];
  const shortcuts: KeyboardShortcut[] = [];
  useKeyboard(shortcuts);

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
