
import React, { useState, useRef } from 'react';
import Canvas, { CanvasHandle } from './components/Canvas';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import ErrorModal from './components/ErrorModal';
import UrlImportModal from './components/UrlImportModal';
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
  shadowGrow: 0,
  
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
  activeLayerId: INITIAL_LAYER_ID,
  selectedLayerIds: [INITIAL_LAYER_ID]
};

const DEFAULT_SETTINGS: AppSettings = {
  enableZoom: true,
  googleApiKey: '',
  imageModel: 'gemini-3-pro-image-preview',
  imageResolution: '1K'
};

interface ImageHistoryItem {
  src: string;
  aspectRatio: AspectRatio;
  orientation: Orientation;
}

export default function App() {
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBlankConfirmOpen, setIsBlankConfirmOpen] = useState(false);
  const [isGenerateConfirmOpen, setIsGenerateConfirmOpen] = useState(false);
  const [isUrlImportOpen, setIsUrlImportOpen] = useState(false);
  
  // Error State
  const [errorState, setErrorState] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });
  
  // Image State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [isGenerating, setIsGenerating] = useState(false);
  
  const canvasRef = useRef<CanvasHandle>(null);

  // --- Error Handling ---
  const handleApiError = (error: any) => {
    console.error("Application Error:", error);
    
    let title = 'An Unexpected Error Occurred';
    let message = 'Something went wrong. Please try again later.';
    const errorMsg = error?.message || JSON.stringify(error) || '';

    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        title = 'Quota Limit Reached';
        message = 'You have exceeded the request limit for the API. Please wait a moment before trying again, or add your own API Key in Settings for higher limits.';
    } else if (errorMsg.includes('API_KEY') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
        title = 'Authorization Error';
        message = 'The API Key provided is invalid or missing permissions. Please check your API Key in Settings.';
    } else if (errorMsg.includes('503') || errorMsg.includes('Overloaded')) {
        title = 'Service Overloaded';
        message = 'The AI models are currently experiencing high traffic. Please try again in a few seconds.';
    } else if (errorMsg.includes('500') || errorMsg.includes('Internal') || errorMsg.includes('Server Error')) {
        title = 'Server Error (500)';
        message = 'The Gemini service encountered an internal error. This is usually temporary. Please try again.';
    } else if (errorMsg.includes('Safety') || errorMsg.includes('blocked')) {
        title = 'Content Blocked';
        message = 'The request was blocked by safety filters. Please modify your prompt and try again.';
    } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
        title = 'Network Error';
        message = 'Could not connect to the AI service. Please check your internet connection.';
    }

    setErrorState({ isOpen: true, title, message });
  };

  // --- History Management ---
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

  // --- Generation Handlers ---
  const handleGenerate = async () => {
    if (!design.prompt) return;
    
    setIsGenerating(true);

    try {
      const imagePromise = generateBackgroundImage(
          design.prompt, 
          design.aspectRatio, 
          design.orientation, 
          settings.googleApiKey,
          settings.imageModel,
          settings.imageResolution
      );
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
      handleApiError(error);
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
          const editedImgData = await editImage(
              imageSrc, 
              design.prompt, 
              design.aspectRatio, 
              design.orientation, 
              settings.googleApiKey,
              settings.imageModel,
              settings.imageResolution
          );
          addToHistory(editedImgData, design.aspectRatio, design.orientation);
      } catch (error) {
          handleApiError(error);
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
        activeLayerId: newId,
        selectedLayerIds: [newId]
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
        handleApiError(new Error("File is too large. Please upload an image smaller than 25MB."));
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
    reader.onerror = () => handleApiError(new Error("Failed to read the file."));
    reader.readAsDataURL(file);
  };

  const handleUrlImport = async (url: string) => {
     try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error("Could not fetch image. Ensure URL is correct and supports CORS.");
        const blob = await response.blob();
        
        let filename = 'imported-image.jpg';
        try {
            const urlPath = new URL(url).pathname;
            const name = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            if (name) filename = name;
        } catch {}

        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        handleImageUpload(file);
     } catch (err: any) {
        handleApiError(new Error("Failed to load image from URL. " + (err.message || "")));
     }
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
        handleApiError(new Error("Could not export image. The canvas may be tainted or too large."));
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

  const shortcuts: KeyboardShortcut[] = [
    {
        id: 'undo',
        combo: { key: 'z', ctrl: true }, // ctrl: true matches both Ctrl and Meta (Cmd) in useKeyboard
        action: handleUndo
    },
    {
        id: 'redo',
        combo: { key: 'z', ctrl: true, shift: true },
        action: handleRedo
    }
  ];
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
          settings={settings}
          onUpdateSettings={setSettings}
          onGenerate={handleGenerateClick}
          onEdit={handleEdit}
          onBlank={handleBlankClick}
          onUpload={handleUploadTrigger}
          onUrlImport={() => setIsUrlImportOpen(true)}
          onDownload={handleDownload}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < imageHistory.length - 1}
          isGenerating={isGenerating}
          vibeReasoning={null}
          hasImage={!!imageSrc}
          onError={handleApiError}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
      
      {/* URL Import Modal */}
      <UrlImportModal
        isOpen={isUrlImportOpen}
        onClose={() => setIsUrlImportOpen(false)}
        onImport={handleUrlImport}
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

      {/* Global Error Modal */}
      <ErrorModal
        isOpen={errorState.isOpen}
        onClose={() => setErrorState(prev => ({ ...prev, isOpen: false }))}
        title={errorState.title}
        message={errorState.message}
      />
    </div>
  );
}
