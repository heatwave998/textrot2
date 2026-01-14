import React, { useState, useRef, useEffect } from 'react';
import Canvas, { CanvasHandle } from './components/Canvas';
import Controls, { ControlsHandle } from './components/Controls';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import ErrorModal from './components/ErrorModal';
import UrlImportModal from './components/UrlImportModal';
import LoadingOverlay from './components/LoadingOverlay';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { DesignState, AppSettings, AspectRatio, Orientation, Point, TextLayer, ImageHistoryItem } from './types';
import { generateBackgroundImage, editImage } from './services/geminiService';
import { useKeyboard, KeyboardShortcut } from './hooks/useKeyboard';
import { createLayer, DEFAULT_DESIGN, DEFAULT_SETTINGS, INITIAL_LAYER_ID } from './utils/defaults';
import { getFriendlyError } from './utils/errorHandler';

export default function App() {
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBlankConfirmOpen, setIsBlankConfirmOpen] = useState(false);
  const [isGenerateConfirmOpen, setIsGenerateConfirmOpen] = useState(false);
  const [isUrlImportOpen, setIsUrlImportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  
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
  const [groundingMetadata, setGroundingMetadata] = useState<any>(null);

  // Loading & Abort State
  const [isGenerating, setIsGenerating] = useState(false); // API call status
  const [isOverlayVisible, setIsOverlayVisible] = useState(false); // UI visibility
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]);
  const [showLoadingDebug, setShowLoadingDebug] = useState(false); 
  
  // Ref to track debug state inside async closures to prevent stale state issues
  const showLoadingDebugRef = useRef(showLoadingDebug);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const controlsRef = useRef<ControlsHandle>(null);

  // Sync ref with state
  useEffect(() => {
    showLoadingDebugRef.current = showLoadingDebug;
  }, [showLoadingDebug]);

  // Sync settings with DOM Overlay for Font Debug
  useEffect(() => {
    const debugEl = document.getElementById('font-loading-debug');
    if (debugEl) {
        debugEl.style.display = settings.showFontDebug ? 'flex' : 'none';
    }
  }, [settings.showFontDebug]);

  // Listen for Font Debug Close from Vanilla JS layer
  useEffect(() => {
    const handleCloseFontDebug = () => {
        setSettings(prev => ({ ...prev, showFontDebug: false }));
    };
    window.addEventListener('textrot-close-font-debug', handleCloseFontDebug);
    return () => window.removeEventListener('textrot-close-font-debug', handleCloseFontDebug);
  }, []);

  // Helper: Log to Loading Overlay
  const log = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setLoadingLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // --- Error Handling ---
  const handleApiError = (error: any) => {
    // Don't show modal for aborts
    if (error instanceof DOMException && error.name === 'AbortError') {
        log("Process Cancelled by User.");
        return;
    }

    console.error("Application Error:", error);
    const { title, message } = getFriendlyError(error);
    setErrorState({ isOpen: true, title, message });
  };

  // --- History Management ---
  const addToHistory = (
      newImageSrc: string, 
      ratio: AspectRatio, 
      orientation: Orientation, 
      layers: TextLayer[], 
      bgType: 'image' | 'solid', 
      bgColor: string, 
      metadata?: any,
      snapshotCurrent: boolean = false
  ) => {
    const currentHistory = imageHistory.slice(0, historyIndex + 1);
    const itemsToAdd: ImageHistoryItem[] = [];

    // Optional: Snapshot current state before adding new item
    // This preserves intermediate work (layer moves, text changes) done before a major action (Upload/Generate)
    if (snapshotCurrent) {
        // Only snapshot if there is actual content or change? 
        // For simplicity and safety, we snapshot if requested.
        // We use current 'design' and 'imageSrc' from state closure.
        itemsToAdd.push({
            src: imageSrc || '',
            aspectRatio: design.aspectRatio,
            orientation: design.orientation,
            layers: design.layers,
            backgroundType: design.backgroundType,
            backgroundColor: design.backgroundColor,
            groundingMetadata: groundingMetadata
        });
    }

    itemsToAdd.push({ 
        src: newImageSrc, 
        aspectRatio: ratio, 
        orientation, 
        layers, 
        backgroundType: bgType,
        backgroundColor: bgColor, 
        groundingMetadata: metadata 
    });
    
    let newHistory = [...currentHistory, ...itemsToAdd];
    
    if (newHistory.length > 20) {
        newHistory = newHistory.slice(newHistory.length - 20);
    }
    
    setImageHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setImageSrc(newImageSrc);
    setGroundingMetadata(metadata);
  };

  // Exposed method to snapshot current design state for granular Undo/Redo (e.g., Font changes)
  const handleSnapshot = (designOverride?: DesignState) => {
      const d = designOverride || design;
      // We rely on current imageSrc for background
      addToHistory(imageSrc || '', d.aspectRatio, d.orientation, d.layers, d.backgroundType, d.backgroundColor, groundingMetadata, false);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const previousState = imageHistory[newIndex];
        
        setHistoryIndex(newIndex);
        setImageSrc(previousState.src);
        setGroundingMetadata(previousState.groundingMetadata);
        
        setDesign(prev => {
            const restoredLayers = previousState.layers.map(l => ({ 
                ...l, 
                // Restore path points from history, only reset interaction modes
                isPathInputMode: false, 
                isPathMoveMode: false 
            }));
            
            let activeId = prev.activeLayerId;
            if (!restoredLayers.find(l => l.id === activeId)) {
                activeId = restoredLayers.length > 0 ? restoredLayers[restoredLayers.length - 1].id : null;
            }

            return {
                ...prev,
                aspectRatio: previousState.aspectRatio,
                orientation: previousState.orientation,
                layers: restoredLayers,
                activeLayerId: activeId,
                selectedLayerIds: activeId ? [activeId] : [],
                backgroundType: previousState.backgroundType,
                backgroundColor: previousState.backgroundColor
            };
        });
    }
  };

  const handleRedo = () => {
      if (historyIndex < imageHistory.length - 1) {
          const newIndex = historyIndex + 1;
          const nextState = imageHistory[newIndex];
          
          setHistoryIndex(newIndex);
          setImageSrc(nextState.src);
          setGroundingMetadata(nextState.groundingMetadata);
          
          setDesign(prev => {
            const restoredLayers = nextState.layers.map(l => ({ 
                ...l, 
                // Restore path points from history, only reset interaction modes
                isPathInputMode: false, 
                isPathMoveMode: false 
            }));
            
            let activeId = prev.activeLayerId;
            if (!restoredLayers.find(l => l.id === activeId)) {
                activeId = restoredLayers.length > 0 ? restoredLayers[restoredLayers.length - 1].id : null;
            }

            return {
                ...prev,
                aspectRatio: nextState.aspectRatio,
                orientation: nextState.orientation,
                layers: restoredLayers,
                activeLayerId: activeId,
                selectedLayerIds: activeId ? [activeId] : [],
                backgroundType: nextState.backgroundType,
                backgroundColor: nextState.backgroundColor
            };
        });
      }
  };

  // --- Generation Handlers ---
  const handleCancelGeneration = () => {
      if (abortControllerRef.current) {
          log("User requested cancellation...");
          abortControllerRef.current.abort();
      }
      setIsGenerating(false);
      setIsOverlayVisible(false);
  };
  
  const handleCloseOverlay = () => {
      setIsOverlayVisible(false);
  };

  const handleGenerate = async () => {
    if (!design.prompt) return;
    
    setIsGenerating(true);
    setIsOverlayVisible(true);
    setLoadingLogs([]);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const result = await generateBackgroundImage(
          design.prompt, 
          design.aspectRatio, 
          design.orientation, 
          settings.googleApiKey,
          settings.imageModel,
          settings.imageResolution,
          settings.quality,
          settings.generationSystemPrompt,
          signal,
          (msg) => log(msg)
      );
      
      const { imageData, groundingMetadata } = result;
      
      log("Image data received. Processing...");
      
      const newLayers = design.layers.map(l => ({
        ...l,
        textOverlay: l.id === design.activeLayerId && l.textOverlay === 'EDIT ME' ? design.prompt.substring(0, 20).toUpperCase() : l.textOverlay,
        // Preserve paths
        isPathInputMode: false,
        isPathMoveMode: false,
      }));

      // Generate sets type to 'image'. Snapshot current state first.
      addToHistory(imageData, design.aspectRatio, design.orientation, newLayers, 'image', design.backgroundColor, groundingMetadata, true);
      
      setDesign(prev => ({
        ...prev,
        layers: newLayers,
        backgroundType: 'image'
      }));
      
      // Reset view for fresh generation
      canvasRef.current?.resetView();
      log("Scene updated successfully.");
      
      setIsGenerating(false);
      // Use Ref to check the LATEST debug state, not the stale closure state
      if (!showLoadingDebugRef.current) {
          setIsOverlayVisible(false);
      }

    } catch (error) {
      setIsGenerating(false);
      if (error instanceof DOMException && error.name === 'AbortError') {
         return; 
      }
      // If error occurs, only close if NOT debugging.
      // Use Ref to check latest state
      if (!showLoadingDebugRef.current) {
          setIsOverlayVisible(false);
      }
      handleApiError(error);
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
      setIsOverlayVisible(true);
      setLoadingLogs([]);

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
          const result = await editImage(
              imageSrc, 
              design.prompt, 
              design.aspectRatio, 
              design.orientation, 
              settings.googleApiKey,
              settings.imageModel,
              settings.imageResolution,
              settings.quality,
              settings.editingSystemPrompt,
              signal,
              (msg) => log(msg)
          );
          
          const { imageData, groundingMetadata } = result;

          log("Response received. Updating canvas...");
          // Edit maintains 'image' type. Snapshot current state first.
          addToHistory(imageData, design.aspectRatio, design.orientation, design.layers, 'image', design.backgroundColor, groundingMetadata, true);
          // Do NOT reset view for Edit (Inpainting)
          log("Edit complete.");
          
          setDesign(prev => ({ ...prev, backgroundType: 'image' }));

          setIsGenerating(false);
          // Use Ref to check LATEST debug state
          if (!showLoadingDebugRef.current) {
              setIsOverlayVisible(false);
          }

      } catch (error) {
          setIsGenerating(false);
          if (error instanceof DOMException && error.name === 'AbortError') {
              return;
          }
          // Use Ref to check LATEST debug state
          if (!showLoadingDebugRef.current) {
              setIsOverlayVisible(false);
          }
          handleApiError(error);
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
    
    const newId = crypto.randomUUID();
    const newLayers = [createLayer(newId, 'BLANK CANVAS')];
    
    // Blank Canvas sets type to 'solid' and defaults to dark gray/black. Snapshot current state first.
    const newBgColor = '#181818';
    addToHistory(blankImgData, design.aspectRatio, design.orientation, newLayers, 'solid', newBgColor, null, true);
    
    setDesign(prev => ({
        ...prev,
        layers: newLayers,
        activeLayerId: newId,
        selectedLayerIds: [newId],
        backgroundType: 'solid',
        backgroundColor: newBgColor
    }));
    
    // Reset view for new blank canvas
    canvasRef.current?.resetView();
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

            const cleanLayers = design.layers.map(l => ({ 
                ...l, 
                // Preserve existing path points, just reset modes
                isPathInputMode: false, 
                isPathMoveMode: false 
            }));
            
            // Upload sets type to 'image'. Snapshot current state first.
            addToHistory(result, closestRatio, newOrientation, cleanLayers, 'image', design.backgroundColor, null, true);
            
            setDesign(prev => ({
                ...prev,
                aspectRatio: closestRatio,
                orientation: newOrientation,
                layers: cleanLayers,
                backgroundType: 'image'
            }));
            
            // Reset view for new upload
            canvasRef.current?.resetView();
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

  const handleStamp = async (idsToStamp: string[]) => {
      if (!canvasRef.current || !imageSrc) return;
      
      const layersSnapshot = design.layers;

      try {
          const newImageSrc = await canvasRef.current.stampLayers(idsToStamp);
          const remainingLayers = layersSnapshot.filter(l => !idsToStamp.includes(l.id));

          setImageHistory(prev => {
              const historyUpToNow = prev.slice(0, historyIndex + 1);

              if (historyUpToNow.length > 0) {
                  const currentTip = historyUpToNow[historyUpToNow.length - 1];
                  historyUpToNow[historyUpToNow.length - 1] = {
                      ...currentTip,
                      layers: layersSnapshot,
                      // Track background state in the history tip to ensure Undo restores color correctly
                      backgroundColor: design.backgroundColor,
                      backgroundType: design.backgroundType,
                      aspectRatio: design.aspectRatio,
                      orientation: design.orientation
                  };
              }

              const newItem: ImageHistoryItem = {
                  src: newImageSrc,
                  aspectRatio: design.aspectRatio,
                  orientation: design.orientation,
                  layers: remainingLayers,
                  backgroundType: 'image', // Stamping effectively creates a new flat image
                  backgroundColor: design.backgroundColor,
                  groundingMetadata // Preserve metadata through stamping
              };
              
              const newHistory = [...historyUpToNow, newItem];
              
              if (newHistory.length > 10) {
                  newHistory.shift();
              }
              
              setHistoryIndex(newHistory.length - 1);
              
              return newHistory;
          });

          setImageSrc(newImageSrc);
          // Do NOT reset view on Stamp
          
          setDesign(prev => {
              const newActiveId = remainingLayers.length > 0 ? remainingLayers[remainingLayers.length - 1].id : null;
              return {
                  ...prev,
                  layers: remainingLayers,
                  activeLayerId: newActiveId,
                  selectedLayerIds: newActiveId ? [newActiveId] : [],
                  backgroundType: 'image' // Stamping flattens to image
              };
          });

      } catch (e) {
          console.error("Stamp failed", e);
          handleApiError(new Error("Failed to stamp layers."));
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
  
  const handleLayerDoubleClick = (layerId: string) => {
    controlsRef.current?.focusTextInput();
  };

  const shortcuts: KeyboardShortcut[] = [
    {
        id: 'undo',
        combo: { code: 'KeyZ', ctrl: true }, 
        action: handleUndo
    },
    {
        id: 'redo',
        combo: { code: 'KeyZ', ctrl: true, shift: true },
        action: handleRedo
    },
    {
        id: 'shortcuts',
        combo: { code: 'Slash', shift: true }, 
        action: () => setIsShortcutsOpen(prev => !prev)
    },
    // FILE OPERATIONS
    {
        id: 'blank',
        combo: { code: 'KeyN', alt: true }, 
        action: handleBlankClick
    },
    {
        id: 'upload',
        combo: { code: 'KeyU', alt: true }, 
        action: handleUploadTrigger
    },
    {
        id: 'import-url',
        combo: { code: 'KeyL', alt: true }, 
        action: () => setIsUrlImportOpen(true)
    }
  ];
  useKeyboard(shortcuts);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-black text-white">
      {/* Loading Overlay */}
      <LoadingOverlay 
        isVisible={isOverlayVisible}
        isProcessing={isGenerating}
        onCancel={handleCancelGeneration} 
        onClose={handleCloseOverlay}
        logs={loadingLogs}
        showDebug={showLoadingDebug}
        setShowDebug={setShowLoadingDebug}
      />

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
            onLayerDoubleClicked={handleLayerDoubleClick}
            className="shadow-2xl ring-1 ring-white/10"
        />
      </div>

      {/* Right: Controls */}
      <div className="w-full md:w-96 h-1/2 md:h-full z-20">
        <Controls 
          ref={controlsRef}
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
          onStamp={handleStamp}
          onRegisterHistory={handleSnapshot}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < imageHistory.length - 1}
          isGenerating={isGenerating}
          vibeReasoning={null}
          hasImage={!!imageSrc}
          onError={handleApiError}
          groundingMetadata={groundingMetadata}
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

      {/* Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
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