
import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { DesignState, FontFamily, AspectRatio, TextLayer, AppSettings, GenModel, ImageResolution } from '../types';
import { 
  Type, Palette, Layers, Download, Sparkles, 
  Bold, Italic, CaseUpper, FlipHorizontal, FlipVertical, 
  RotateCw, Settings, FilePlus, ImagePlus,
  Monitor, Smartphone, AlignCenterHorizontal, PenTool, Trash2, Route,
  AlignLeft, AlignCenter, AlignRight, Move, Activity,
  Maximize, MoveHorizontal, MoveVertical, Undo2, Redo2, ToggleRight, ToggleLeft, Paintbrush,
  Plus, Eye, EyeOff, ChevronUp, ChevronDown, Wand2, BoxSelect, BookType, Link as LinkIcon, Stamp,
  Sliders, ToggleLeft as ToggleOff, ToggleRight as ToggleOn, Globe
} from 'lucide-react';
import SliderControl from './SliderControl';
import EffectsControls from './EffectsControls';
import ConfirmationModal from './ConfirmationModal';
import FontBookModal from './FontBookModal';
import CollapsibleSection from './CollapsibleSection';
import Tooltip from './Tooltip';
import { useIsKeyPressed, useKeyboard } from '../hooks/useKeyboard';
import { FONTS, VARIABLE_FONTS } from '../constants';

interface ControlsProps {
  design: DesignState;
  setDesign: React.Dispatch<React.SetStateAction<DesignState>>;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onGenerate: () => void;
  onEdit: () => void;
  onBlank: () => void;
  onUpload: () => void;
  onUrlImport: () => void;
  onDownload: () => void;
  onOpenSettings: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onStamp: (ids: string[]) => void;
  canUndo: boolean;
  canRedo: boolean;
  isGenerating: boolean;
  vibeReasoning: string | null;
  hasImage: boolean;
  onError?: (error: any) => void;
  groundingMetadata?: any;
}

export interface ControlsHandle {
  focusTextInput: () => void;
}

const RATIOS: AspectRatio[] = ['1:1', '4:3', '3:2', '16:9'];
const RESOLUTIONS: ImageResolution[] = ['1K', '2K', '4K'];

// Nudge Amounts in Percentages
const NUDGE_SMALL = 0.1;
const NUDGE_MEDIUM = 0.5;
const NUDGE_LARGE = 5.0;

const Controls = forwardRef<ControlsHandle, ControlsProps>(({ 
  design, 
  setDesign, 
  settings,
  onUpdateSettings,
  onGenerate, 
  onEdit,
  onBlank,
  onUpload,
  onUrlImport,
  onDownload,
  onOpenSettings,
  onUndo,
  onRedo,
  onStamp,
  canUndo,
  canRedo,
  isGenerating,
  hasImage,
  onError,
  groundingMetadata
}, ref) => {
  const [layerToDelete, setLayerToDelete] = useState<string | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [isFontBookOpen, setIsFontBookOpen] = useState(false);
  
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Panel State for Keyboard Shortcuts
  const [panelState, setPanelState] = useState({
    gen: true,
    layers: true,
    content: true,
    typography: true,
    appearance: false,
    transform: false,
    path: false,
    effects: false,
    blending: false
  });

  const togglePanel = (key: keyof typeof panelState) => {
    setPanelState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllPanels = useCallback(() => {
    setPanelState(prev => {
        // If all are currently open, collapse all. Otherwise, expand all.
        const allOpen = Object.values(prev).every(v => v === true);
        const newState = !allOpen;
        
        return {
            gen: newState,
            layers: newState,
            content: newState,
            typography: newState,
            appearance: newState,
            transform: newState,
            path: newState,
            effects: newState,
            blending: newState
        };
    });
  }, []);

  const focusTextInputInternal = useCallback(() => {
    setPanelState(prev => ({ ...prev, content: true }));
    // Small delay to ensure panel expansion render
    setTimeout(() => {
        if (textInputRef.current) {
            textInputRef.current.focus();
            textInputRef.current.select();
        }
    }, 100);
  }, []);

  useImperativeHandle(ref, () => ({
    focusTextInput: focusTextInputInternal
  }), [focusTextInputInternal]);

  // Keyboard Shortcuts for Panel Toggles
  const panelShortcuts = useMemo(() => [
    { id: 'toggle-all', combo: { code: 'Backquote', shift: true }, action: toggleAllPanels },
    { id: 'toggle-gen', combo: { code: 'Digit0', shift: true}, action: () => togglePanel('gen') },
    { id: 'toggle-layers', combo: { code: 'Digit1', shift: true }, action: () => togglePanel('layers') },
    { id: 'toggle-content', combo: { code: 'Digit2', shift: true }, action: () => togglePanel('content') },
    { id: 'toggle-typography', combo: { code: 'Digit3', shift: true }, action: () => togglePanel('typography') },
    { id: 'toggle-appearance', combo: { code: 'Digit4', shift: true }, action: () => togglePanel('appearance') },
    { id: 'toggle-transform', combo: { code: 'Digit5', shift: true }, action: () => togglePanel('transform') },
    { id: 'toggle-path', combo: { code: 'Digit6', shift: true }, action: () => togglePanel('path') },
    { id: 'toggle-effects', combo: { code: 'Digit7', shift: true }, action: () => togglePanel('effects') },
    { id: 'toggle-blending', combo: { code: 'Digit8', shift: true }, action: () => togglePanel('blending') },
  ], [toggleAllPanels]);
  
  useKeyboard(panelShortcuts);

  // --- Layer Nudging Logic ---
  const nudgeLayer = useCallback((axis: 'x' | 'y', delta: number) => {
      setDesign(prev => {
          if (prev.selectedLayerIds.length === 0) return prev;
          return {
              ...prev,
              layers: prev.layers.map(l => {
                  if (!prev.selectedLayerIds.includes(l.id)) return l;
                  return {
                      ...l,
                      overlayPosition: {
                          ...l.overlayPosition,
                          [axis]: l.overlayPosition[axis] + delta
                      }
                  };
              })
          };
      });
  }, [setDesign]);

  const nudgeShortcuts = useMemo(() => [
      // Base (Medium Nudge) - No modifiers
      { id: 'nudge-up', combo: { code: 'ArrowUp' }, action: () => nudgeLayer('y', -NUDGE_MEDIUM) },
      { id: 'nudge-down', combo: { code: 'ArrowDown' }, action: () => nudgeLayer('y', NUDGE_MEDIUM) },
      { id: 'nudge-left', combo: { code: 'ArrowLeft' }, action: () => nudgeLayer('x', -NUDGE_MEDIUM) },
      { id: 'nudge-right', combo: { code: 'ArrowRight' }, action: () => nudgeLayer('x', NUDGE_MEDIUM) },

      // Shift (Large Nudge)
      { id: 'nudge-up-lg', combo: { code: 'ArrowUp', shift: true }, action: () => nudgeLayer('y', -NUDGE_LARGE) },
      { id: 'nudge-down-lg', combo: { code: 'ArrowDown', shift: true }, action: () => nudgeLayer('y', NUDGE_LARGE) },
      { id: 'nudge-left-lg', combo: { code: 'ArrowLeft', shift: true }, action: () => nudgeLayer('x', -NUDGE_LARGE) },
      { id: 'nudge-right-lg', combo: { code: 'ArrowRight', shift: true }, action: () => nudgeLayer('x', NUDGE_LARGE) },

      // Alt (Micro Nudge)
      { id: 'nudge-up-sm', combo: { code: 'ArrowUp', alt: true }, action: () => nudgeLayer('y', -NUDGE_SMALL) },
      { id: 'nudge-down-sm', combo: { code: 'ArrowDown', alt: true }, action: () => nudgeLayer('y', NUDGE_SMALL) },
      { id: 'nudge-left-sm', combo: { code: 'ArrowLeft', alt: true }, action: () => nudgeLayer('x', -NUDGE_SMALL) },
      { id: 'nudge-right-sm', combo: { code: 'ArrowRight', alt: true }, action: () => nudgeLayer('x', NUDGE_SMALL) },
  ], [nudgeLayer]);

  useKeyboard(nudgeShortcuts);

  // Keyboard States
  const isShiftPressed = useIsKeyPressed('Shift');
  const isAltPressed = useIsKeyPressed('Alt');
  const isGranularMode = (isShiftPressed || isAltPressed);

  // Global State Updates
  const updateGlobal = (key: keyof DesignState, value: any) => {
    setDesign(prev => ({ ...prev, [key]: value }));
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newModel = e.target.value as GenModel;
      const isFlash = newModel === 'gemini-2.5-flash-image';
      
      onUpdateSettings({
          ...settings,
          imageModel: newModel,
          imageResolution: isFlash ? '1K' : settings.imageResolution
      });
  };

  const handleResolutionChange = (res: ImageResolution) => {
      onUpdateSettings({
          ...settings,
          imageResolution: res
      });
  };

  // Active Layer Updates
  const activeLayer = design.layers.find(l => l.id === design.activeLayerId);
  
  const updateLayer = (key: keyof TextLayer, value: any) => {
    if (!design.activeLayerId) return;
    setDesign(prev => ({
        ...prev,
        layers: prev.layers.map(l => prev.selectedLayerIds.includes(l.id) ? { ...l, [key]: value } : l)
    }));
  };

  const updateFontVariation = (axisTag: string, value: number) => {
    if (!design.activeLayerId) return;
    setDesign(prev => ({
        ...prev,
        layers: prev.layers.map(l => {
            if (!prev.selectedLayerIds.includes(l.id)) return l;
            return {
                ...l,
                fontVariations: {
                    ...l.fontVariations,
                    [axisTag]: value
                }
            };
        })
    }));
  };

  const toggleLayer = (key: keyof TextLayer) => {
    if (!activeLayer) return;
    // We toggle based on the active layer's state, enforcing consistency across selection
    const newValue = !activeLayer[key];
    updateLayer(key, newValue);
  };

  const updatePosition = (axis: 'x' | 'y', value: number) => {
      if (!activeLayer) return;
      updateLayer('overlayPosition', { ...activeLayer.overlayPosition, [axis]: value });
  };

  // Selection Logic
  const handleLayerClick = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const { ctrlKey, metaKey, shiftKey } = e;
      const isMultiSelect = ctrlKey || metaKey;
      
      setDesign(prev => {
          let newSelected = [...prev.selectedLayerIds];
          let newActive = prev.activeLayerId;

          if (isMultiSelect) {
              if (newSelected.includes(id)) {
                  newSelected = newSelected.filter(sid => sid !== id);
                  // If we deselected the active layer, pick the last one remaining, or null
                  if (newActive === id) {
                      newActive = newSelected.length > 0 ? newSelected[newSelected.length - 1] : null;
                  }
              } else {
                  newSelected.push(id);
                  newActive = id; // Make newly selected active
              }
          } else if (shiftKey && prev.activeLayerId) {
               // Range select
               const allIds = prev.layers.slice().reverse().map(l => l.id); // Visual order (Top to Bottom)
               const startIdx = allIds.indexOf(prev.activeLayerId);
               const endIdx = allIds.indexOf(id);
               
               if (startIdx !== -1 && endIdx !== -1) {
                   const min = Math.min(startIdx, endIdx);
                   const max = Math.max(startIdx, endIdx);
                   const range = allIds.slice(min, max + 1);
                   const set = new Set([...newSelected, ...range]);
                   newSelected = Array.from(set);
                   newActive = id;
               }
          } else {
              // Single select
              newSelected = [id];
              newActive = id;
          }

          return {
              ...prev,
              selectedLayerIds: newSelected,
              activeLayerId: newActive
          };
      });
  };

  // Layer Management
  const handleAddLayer = () => {
      const newId = crypto.randomUUID();
      const newLayer: TextLayer = {
        id: newId,
        name: `Layer ${design.layers.length + 1}`,
        visible: true,
        locked: false,
        textOverlay: 'New Text',
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
        fontVariations: {},
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
        isRainbowLights: false,
        rainbowOpacity: 1.0,
        rainbowBlur: 0,
        effectAngle: 90,
        rotation: 0,
        flipX: false,
        flipY: false
      };
      
      setDesign(prev => ({
          ...prev,
          layers: [...prev.layers, newLayer],
          activeLayerId: newId,
          selectedLayerIds: [newId]
      }));
  };

  const handleDeleteLayer = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setLayerToDelete(id);
  };

  const confirmDeleteLayer = () => {
      if (!layerToDelete) return;

      setDesign(prev => {
          const isSelected = prev.selectedLayerIds.includes(layerToDelete);
          
          let idsToDelete = [layerToDelete];

          const newLayers = prev.layers.filter(l => !idsToDelete.includes(l.id));
          const newSelected = prev.selectedLayerIds.filter(id => !idsToDelete.includes(id));
          
          let newActive = prev.activeLayerId;
          if (idsToDelete.includes(newActive || '')) {
              newActive = newSelected.length > 0 ? newSelected[newSelected.length - 1] : (newLayers.length > 0 ? newLayers.length - 1 >= 0 ? newLayers[newLayers.length - 1].id : null : null);
          }

          return {
              ...prev,
              layers: newLayers,
              activeLayerId: newActive,
              selectedLayerIds: newSelected.length === 0 && newActive ? [newActive] : newSelected
          };
      });
      setLayerToDelete(null);
  };

  const handleToggleVisible = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDesign(prev => {
          // If target is in selection, toggle all selected
          const targetIsSelected = prev.selectedLayerIds.includes(id);
          const idsToToggle = targetIsSelected ? prev.selectedLayerIds : [id];
          
          // Determine target state based on the clicked item
          const clickedLayer = prev.layers.find(l => l.id === id);
          const targetState = !clickedLayer?.visible;

          return {
              ...prev,
              layers: prev.layers.map(l => idsToToggle.includes(l.id) ? { ...l, visible: targetState } : l)
          };
      });
  };

  const moveLayer = (id: string, direction: 'forward' | 'backward', e: React.MouseEvent) => {
      e.stopPropagation();
      setDesign(prev => {
          // Moving multiple layers is complex. Only move clicked layer for now.
          const index = prev.layers.findIndex(l => l.id === id);
          if (index === -1) return prev;
          
          const newLayers = [...prev.layers];
          if (direction === 'forward' && index < newLayers.length - 1) {
              // Swap with next (move towards top of stack)
              [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
          } else if (direction === 'backward' && index > 0) {
              // Swap with previous (move towards bottom of stack)
              [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
          } else {
              return prev;
          }
          return { ...prev, layers: newLayers };
      });
  };

  const getRatioLabel = (ratio: AspectRatio) => {
      if (design.orientation === 'portrait') {
          const [w, h] = ratio.split(':');
          return `${h}:${w}`;
      }
      return ratio;
  };

  const isFlash = settings.imageModel === 'gemini-2.5-flash-image';
  
  // Computed states for buttons
  const isGenerateDisabled = isGenerating || !design.prompt.trim();
  const isEditDisabled = isGenerating || !hasImage || !design.prompt.trim();

  // Get Variable Axes for current font
  const variableConfig = activeLayer ? VARIABLE_FONTS[activeLayer.fontFamily] : undefined;

  return (
    <div className="h-full flex flex-col bg-neutral-900 border-l border-neutral-800 overflow-hidden">
      
      {/* Header */}
      <div className="p-6 border-b border-neutral-800 flex items-start justify-between bg-neutral-900 shrink-0 z-10">
        <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500 mb-1">
            ///textrot studio
            </h2>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={onOpenSettings}
                className="text-neutral-500 hover:text-white transition-colors p-2 rounded-[3px] hover:bg-neutral-800"
                title="Settings"
            >
                <Settings size={20} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Generator Section */}
        <CollapsibleSection 
            title="Image Generator" 
            icon={Wand2} 
            isOpen={panelState.gen}
            onToggle={() => togglePanel('gen')}
        >
          <div className="space-y-4 pt-1">

            {/* MOVED UP: Model & Resolution Controls */}
            <div className="flex items-center justify-between">
                {/* Resolution Toggles */}
                <div className="flex bg-neutral-950 p-0.5 rounded-[3px] border border-neutral-800">
                    {RESOLUTIONS.map((res) => (
                        <button
                            key={res}
                            onClick={() => handleResolutionChange(res)}
                            disabled={isFlash && res !== '1K'}
                            className={`px-3 py-1.5 rounded-[2px] text-[10px] font-bold transition-all ${
                                settings.imageResolution === res 
                                ? 'bg-neutral-800 text-white shadow-sm' 
                                : isFlash && res !== '1K' 
                                    ? 'text-neutral-800 cursor-not-allowed' 
                                    : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                        >
                            {res}
                        </button>
                    ))}
                </div>

                {/* Model Dropdown */}
                <div className="relative min-w-[120px]">
                     <select
                        value={settings.imageModel}
                        onChange={handleModelChange}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] py-1.5 px-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors appearance-none cursor-pointer text-left pr-6"
                    >
                        <option value="gemini-2.5-flash-image">Nana 🍌</option>
                        <option value="gemini-3-pro-image-preview">Nano 🍌 Pro</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                </div>
            </div>
            
            {/* MOVED UP: Aspect Ratio & Orientation */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Aspect Ratio</label>
                    <div className="flex bg-neutral-950 p-0.5 rounded-[3px] border border-neutral-800">
                      <button
                          onClick={() => updateGlobal('orientation', 'landscape')}
                          className={`px-2 py-1 rounded-[2px] text-[10px] transition-all ${design.orientation === 'landscape' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                      >
                          <Monitor size={12} />
                      </button>
                      <button
                          onClick={() => updateGlobal('orientation', 'portrait')}
                          className={`px-2 py-1 rounded-[2px] text-[10px] transition-all ${design.orientation === 'portrait' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                      >
                          <Smartphone size={12} />
                      </button>
                    </div>
                </div>
                
                <div className="flex gap-1">
                    {RATIOS.map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => updateGlobal('aspectRatio', ratio)}
                            className={`flex-1 py-2 rounded-[3px] text-xs font-medium border ${design.aspectRatio === ratio ? 'bg-neutral-800 text-pink-500 border-pink-500/50' : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900'}`}
                        >
                            {getRatioLabel(ratio)}
                        </button>
                    ))}
                </div>
            </div>

            {/* MOVED UP: Utility Buttons */}
            <div className="flex gap-2 h-9">
                <Tooltip content="Reset / Blank Canvas" position="bottom" className="flex-1">
                    <button onClick={onBlank} className="w-full h-full bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] flex items-center justify-center gap-2 text-xs font-medium border border-neutral-700/50 transition-colors"> 
                        <FilePlus size={14} /> Blank
                    </button>
                </Tooltip>
                <Tooltip content="Upload Image" position="bottom" className="flex-1">
                    <button onClick={onUpload} className="w-full h-full bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] flex items-center justify-center gap-2 text-xs font-medium border border-neutral-700/50 transition-colors"> 
                        <ImagePlus size={14} /> Upload
                    </button>
                </Tooltip>
                <Tooltip content="Load from URL" position="bottom" className="flex-1">
                    <button onClick={onUrlImport} className="w-full h-full bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] flex items-center justify-center gap-2 text-xs font-medium border border-neutral-700/50 transition-colors"> 
                        <LinkIcon size={14} /> Link
                    </button>
                </Tooltip>
            </div>

            {/* Image Prompt Section */}
            <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-neutral-200 uppercase tracking-wider">Image Prompt</label>
                <div className="flex items-center gap-1">
                  <button 
                      onClick={onUndo}
                      disabled={!canUndo}
                      className={`p-1 rounded-[3px] transition-colors ${canUndo ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-800 cursor-not-allowed'}`}
                  >
                      <Undo2 size={16} />
                  </button>
                  <button 
                      onClick={onRedo}
                      disabled={!canRedo}
                      className={`p-1 rounded-[3px] transition-colors ${canRedo ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-800 cursor-not-allowed'}`}
                  >
                      <Redo2 size={16} />
                  </button>
                </div>
            </div>
            <textarea 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-3 text-sm focus:outline-none focus:border-pink-500 transition-colors resize-y min-h-[6rem]"
              placeholder="e.g. A cyberpunk samurai in neon rain..."
              value={design.prompt}
              onChange={(e) => updateGlobal('prompt', e.target.value)}
            />

            {/* Generate & Edit Buttons */}
            <div className="flex gap-2 h-10">
                <button 
                    onClick={onGenerate}
                    disabled={isGenerateDisabled}
                    className={`flex-1 rounded-[3px] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${isGenerateDisabled ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:brightness-110 hover:shadow-pink-500/20'}`}
                >
                    {isGenerating ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></span> : <><Sparkles size={16} /> Generate</>}
                </button>
                
                <div className="flex-1">
                    <Tooltip content="Edit Image (Inpainting)" position="bottom" className="w-full h-full">
                        <div className={`relative w-full h-full rounded-[3px] group ${isEditDisabled ? '' : 'p-[1px]'}`}>
                            {!isEditDisabled && (
                                <>
                                    {/* Rainbow Border Gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded-[3px] opacity-100"></div>
                                    {/* Rainbow Glow */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded-[3px] blur-[4px] opacity-30 group-hover:opacity-70 transition-opacity duration-300"></div>
                                </>
                            )}
                            <button 
                                onClick={onEdit} 
                                disabled={isEditDisabled} 
                                className={`relative w-full h-full rounded-[2px] font-bold text-sm flex items-center justify-center gap-2 transition-all ${isEditDisabled ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-70' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
                            > 
                                <Paintbrush size={16} /> Edit
                            </button>
                        </div>
                    </Tooltip>
                </div>
            </div>

            {/* Search Grounding Sources */}
            {groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0 && (
                <div className="mt-2 text-xs animate-in slide-in-from-top-1 fade-in">
                    <div className="text-[10px] font-bold text-neutral-500 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                        <Globe size={10} /> Sources
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {groundingMetadata.groundingChunks.map((chunk: any, i: number) => {
                            if (!chunk.web) return null;
                            const hostname = tryGetHostname(chunk.web.uri);
                            return (
                                <a 
                                    key={i} 
                                    href={chunk.web.uri} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="block bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white px-2 py-1 rounded-[3px] border border-neutral-700 transition-colors truncate max-w-[200px]"
                                    title={chunk.web.title}
                                >
                                    {chunk.web.title || hostname}
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

          </div>
        </CollapsibleSection>

        {/* Layers Section (Shift+1) */}
        <CollapsibleSection 
            title="Layers" 
            icon={Layers} 
            isOpen={panelState.layers}
            onToggle={() => togglePanel('layers')}
        >
            <div className={`transition-all duration-300 ${!hasImage ? 'opacity-40 pointer-events-none filter grayscale' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-neutral-500">
                        {design.selectedLayerIds.length > 1 ? `${design.selectedLayerIds.length} Layers Selected` : 'Manage Stacking Order'}
                    </div>
                    <button onClick={handleAddLayer} className="text-neutral-400 hover:text-white hover:bg-neutral-800 p-1 rounded-[3px] transition-colors">
                        <Plus size={16} />
                    </button>
                </div>
                
                <div className="bg-neutral-950 border border-neutral-800 rounded-[3px] overflow-hidden max-h-48 overflow-y-auto">
                    {design.layers.slice().reverse().map((layer) => {
                        const originalIndex = design.layers.findIndex(l => l.id === layer.id);
                        const isTop = originalIndex === design.layers.length - 1;
                        const isBottom = originalIndex === 0;
                        const isSelected = design.selectedLayerIds.includes(layer.id);
                        const isActive = layer.id === design.activeLayerId;
                        const hasPath = layer.pathPoints.length > 0;

                        return (
                        <div 
                            key={layer.id}
                            onClick={(e) => handleLayerClick(layer.id, e)}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                focusTextInputInternal();
                            }}
                            className={`flex items-center justify-between p-2 text-xs border-b border-neutral-800 last:border-0 cursor-pointer group ${
                                isSelected 
                                ? (isActive ? 'bg-neutral-800 text-white' : 'bg-neutral-800/50 text-neutral-300') 
                                : 'text-neutral-400 hover:bg-neutral-900'
                            }`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                 <span className={`font-mono select-none ${isActive ? 'text-pink-500' : 'opacity-50'}`}>T</span>
                                 <span className="truncate max-w-[100px]">{layer.textOverlay || 'Empty Text'}</span>
                                 {hasPath && (
                                     <Tooltip content="Path Text Enabled">
                                         <Route size={12} className="text-pink-400 opacity-80" />
                                     </Tooltip>
                                 )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <div className="flex flex-col gap-0.5 mr-2">
                                    <button 
                                        onClick={(e) => moveLayer(layer.id, 'forward', e)}
                                        disabled={isTop}
                                        className="p-0.5 hover:text-white hover:bg-neutral-700 rounded-[2px] disabled:opacity-20 disabled:hover:bg-transparent"
                                        title="Bring Forward"
                                    >
                                        <ChevronUp size={10} />
                                    </button>
                                    <button 
                                        onClick={(e) => moveLayer(layer.id, 'backward', e)}
                                        disabled={isBottom}
                                        className="p-0.5 hover:text-white hover:bg-neutral-700 rounded-[2px] disabled:opacity-20 disabled:hover:bg-transparent"
                                        title="Send Backward"
                                    >
                                        <ChevronDown size={10} />
                                    </button>
                                 </div>
                                 <div className="w-px h-6 bg-neutral-800 mx-1"></div>
                                 <button onClick={(e) => handleToggleVisible(layer.id, e)} className="p-1 hover:text-white">
                                     {layer.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
                                 </button>
                                 <button onClick={(e) => handleDeleteLayer(layer.id, e)} className="p-1 hover:text-red-400">
                                     <Trash2 size={12}/>
                                 </button>
                            </div>
                        </div>
                    )})}
                    {design.layers.length === 0 && (
                        <div className="p-4 text-center text-neutral-600 text-[10px] italic">No text layers. Click + to add.</div>
                    )}
                </div>

                {/* Stamp Buttons */}
                {design.selectedLayerIds.length > 0 && (
                    <div className="mt-3 flex gap-2 animate-in slide-in-from-top-1 fade-in">
                        <button 
                            onClick={() => onStamp(design.selectedLayerIds)}
                            className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] text-xs font-medium flex items-center justify-center gap-2 border border-neutral-700/50 transition-colors"
                        >
                            <Stamp size={14} />
                            {design.selectedLayerIds.length > 1 ? 'Stamp Selected' : 'Stamp Layer'}
                        </button>
                    </div>
                )}
            </div>
        </CollapsibleSection>

        {hasImage && activeLayer ? (
        <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 pb-12">
          
          {/* Text Content (Shift+2) */}
          <CollapsibleSection 
              title="Text Content" 
              icon={Type} 
              isOpen={panelState.content}
              onToggle={() => togglePanel('content')}
          >
            {design.selectedLayerIds.length > 1 ? (
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-[3px] text-center text-xs text-neutral-500 italic">
                    Multi-edit enabled for style properties.<br/>Select single layer to edit text content.
                </div>
            ) : (
                <textarea 
                  ref={textInputRef}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-sm focus:border-pink-500 outline-none resize-y"
                  rows={2}
                  value={activeLayer.textOverlay}
                  onChange={(e) => updateLayer('textOverlay', e.target.value)}
                />
            )}
          </CollapsibleSection>

          {/* Typography (Shift+3) */}
          <CollapsibleSection 
              title="Typography" 
              icon={Palette} 
              isOpen={panelState.typography}
              onToggle={() => togglePanel('typography')}
          >
            
            {/* Font Book Button */}
            <button 
                onClick={() => setIsFontBookOpen(true)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-left flex items-center justify-between hover:border-neutral-600 transition-colors group mb-3"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[2px] bg-neutral-900 flex items-center justify-center text-lg font-bold text-white border border-neutral-800 group-hover:border-neutral-600 transition-colors">
                        Aa
                    </div>
                    <div>
                        <span className="block text-sm text-white" style={{ fontFamily: activeLayer.fontFamily }}>
                            {activeLayer.fontFamily}
                        </span>
                        {design.selectedLayerIds.length > 1 && <span className="text-[10px] text-neutral-500">Apply to all selected</span>}
                    </div>
                </div>
                <BookType size={16} className="text-neutral-600 group-hover:text-white transition-colors" />
            </button>

            <div className="flex gap-1 bg-neutral-950 rounded-[6px] p-1 border border-neutral-800 mb-2">
                <button onClick={() => toggleLayer('isBold')} className={`flex-1 h-10 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${activeLayer.isBold ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}><Bold size={18} strokeWidth={3} /></button>
                <button onClick={() => toggleLayer('isItalic')} className={`flex-1 h-10 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${activeLayer.isItalic ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}><Italic size={18} /></button>
                <button onClick={() => toggleLayer('isUppercase')} className={`flex-1 h-10 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${activeLayer.isUppercase ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}><CaseUpper size={28} /></button>
            </div>

            <div className="flex gap-2">
                  <div className="flex-1 flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800">
                      <button onClick={() => updateLayer('textAlign', 'left')} className={`flex-1 h-8 rounded-[3px] flex items-center justify-center ${activeLayer.textAlign === 'left' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}><AlignLeft size={16} /></button>
                      <button onClick={() => updateLayer('textAlign', 'center')} className={`flex-1 h-8 rounded-[3px] flex items-center justify-center ${activeLayer.textAlign === 'center' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}><AlignCenter size={16} /></button>
                      <button onClick={() => updateLayer('textAlign', 'right')} className={`flex-1 h-8 rounded-[3px] flex items-center justify-center ${activeLayer.textAlign === 'right' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}><AlignRight size={16} /></button>
                  </div>
                  <div className="flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800">
                      
                  </div>
            </div>

            {/* Variable Axes Subpanel */}
            {variableConfig && variableConfig.axes.length > 0 && (
                 <div className="mt-2 mb-3 space-y-2 bg-neutral-950 border border-neutral-800 p-2 rounded-[3px] animate-in slide-in-from-top-1 fade-in">
                    <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Sliders size={10} /> Variable Axes
                    </div>
                    {variableConfig.axes.map(axis => {
                        const currentValue = activeLayer.fontVariations?.[axis.tag] ?? axis.defaultValue;
                        
                        if (axis.inputType === 'toggle') {
                            const isToggled = currentValue === 1;
                            return (
                                <div key={axis.tag} className="flex items-center justify-between h-8">
                                    <label className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                                        {axis.name}
                                    </label>
                                    <button
                                        onClick={() => updateFontVariation(axis.tag, isToggled ? 0 : 1)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-[3px] border transition-colors ${
                                            isToggled 
                                            ? 'bg-neutral-800 border-pink-500 text-pink-500' 
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                                        }`}
                                    >
                                        {isToggled ? <ToggleOn size={16} /> : <ToggleOff size={16} />}
                                        <span className="text-[10px] font-bold">{isToggled ? 'ON' : 'OFF'}</span>
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <SliderControl 
                                key={axis.tag}
                                label={axis.name}
                                value={currentValue}
                                setValue={(v) => updateFontVariation(axis.tag, v)}
                                min={axis.min}
                                max={axis.max}
                                step={axis.step}
                                defaultValue={axis.defaultValue}
                            />
                        );
                    })}
                 </div>
            )}
            
            <div className="flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800 mb-2">
                  <button onClick={() => toggleLayer('flipX')} className={`flex-1 h-8 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${activeLayer.flipX ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}><FlipHorizontal size={16} /></button>
                  <button onClick={() => toggleLayer('flipY')} className={`flex-1 h-8 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${activeLayer.flipY ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}><FlipVertical size={16} /></button>
            </div>

            <SliderControl label="Kerning" icon={AlignCenterHorizontal} value={activeLayer.letterSpacing} setValue={(v) => updateLayer('letterSpacing', v)} min="-20" max="100" step="1" suffix="px" defaultValue={0} />
            <SliderControl label="Letter Rotate" icon={RotateCw} value={activeLayer.letterRotation} setValue={(v) => updateLayer('letterRotation', v)} min="-180" max="180" step="1" suffix="°" defaultValue={0} />
            
            <div 
                onMouseEnter={() => setHoveredControl('size')}
                onMouseLeave={() => setHoveredControl(null)}
                className="transition-colors duration-200"
            >
                <SliderControl 
                    label={isGranularMode && hoveredControl === 'size' ? "Granular Size" : "Size"} 
                    icon={Maximize} 
                    value={activeLayer.textSize} 
                    setValue={(v) => updateLayer('textSize', v)} 
                    min="0.1" 
                    max="50" 
                    step={isGranularMode && hoveredControl === 'size' ? "0.01" : "0.5"} 
                    suffix="%" 
                    defaultValue={5}
                />
            </div>
          </CollapsibleSection>

          {/* Appearance (Shift+4) */}
          <CollapsibleSection 
              title="Appearance" 
              icon={Palette} 
              isOpen={panelState.appearance}
              onToggle={() => togglePanel('appearance')}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                  <div className="flex items-center mb-1 h-9"><label className="text-[10px] text-neutral-500 block">Text Color</label></div>
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-10">
                      <input type="color" value={activeLayer.textColor} onChange={(e) => updateLayer('textColor', e.target.value)} className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none" />
                      <span className="text-xs font-mono text-neutral-400">{activeLayer.textColor}</span>
                  </div>
              </div>
              
              <div>
                  <div className="flex items-center justify-between mb-1 h-9">
                      <label className="text-[10px] text-neutral-500">Shadow/Glow</label>
                      <button onClick={() => toggleLayer('hasShadow')} className="text-neutral-500 hover:text-pink-500 transition-colors focus:outline-none flex items-center justify-end">
                          {activeLayer.hasShadow ? <ToggleRight size={28} className="text-pink-500"/> : <ToggleLeft size={28}/>}
                      </button>
                  </div>
                  <div className={`flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-10 transition-opacity ${!activeLayer.hasShadow ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input type="color" value={activeLayer.shadowColor} onChange={(e) => updateLayer('shadowColor', e.target.value)} className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none" />
                      <span className="text-xs font-mono text-neutral-400">{activeLayer.shadowColor}</span>
                  </div>
              </div>
            </div>

            <div className={`transition-opacity space-y-4 pt-4 ${!activeLayer.hasShadow ? 'opacity-50 pointer-events-none' : ''}`}>
                <SliderControl label="Shadow Blur" value={activeLayer.shadowBlur} setValue={(v) => updateLayer('shadowBlur', v)} min="0" max="100" step="1" defaultValue={20} />
                <SliderControl label="Shadow Offset" value={activeLayer.shadowOffset} setValue={(v) => updateLayer('shadowOffset', v)} min="0" max="100" step="1" defaultValue={20} />
                <SliderControl label="Shadow Angle" value={activeLayer.shadowAngle} setValue={(v) => updateLayer('shadowAngle', v)} min="0" max="360" step="1" suffix="°" defaultValue={45} />
                <SliderControl label="Shadow Opacity" value={(activeLayer.shadowOpacity ?? 1.0) * 100} setValue={(v) => updateLayer('shadowOpacity', v / 100)} min="0" max="100" step="1" suffix="%" defaultValue={100} />
            </div>
          </CollapsibleSection>

          {/* Transform (Shift+5) */}
          <CollapsibleSection 
              title="Transform" 
              icon={Move} 
              isOpen={panelState.transform}
              onToggle={() => togglePanel('transform')}
          >
            <div className="grid grid-cols-2 gap-4">
                <SliderControl label="X Pos" icon={MoveHorizontal} value={activeLayer.overlayPosition.x} setValue={(v) => updatePosition('x', v)} min="0" max="100" step="1" suffix="%" defaultValue={50} />
                <SliderControl label="Y Pos" icon={MoveVertical} value={100 - activeLayer.overlayPosition.y} setValue={(v) => updatePosition('y', 100 - v)} min="0" max="100" step="1" suffix="%" defaultValue={50} />
            </div>

            <div>
                  <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-neutral-500 flex items-center gap-1.5"><RotateCw size={12} />Rotation</label>
                      <span className="text-[10px] text-neutral-500 font-mono">{Math.round(activeLayer.rotation)}°</span>
                  </div>
                  <div className="relative flex items-center h-5">
                      <input 
                          type="range" min="0" max="360" step="1" value={Math.round(activeLayer.rotation)}
                          onChange={(e) => {
                              let val = parseInt(e.target.value);
                              const snapPoints = [0, 45, 90, 135, 180, 225, 270, 315, 360];
                              for (const point of snapPoints) if (Math.abs(val - point) <= 15) { val = point; break; }
                              updateLayer('rotation', val);
                          }}
                          onDoubleClick={() => updateLayer('rotation', 0)}
                          className="relative z-10 w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white block focus:outline-none hover:bg-neutral-700 transition-colors"
                          title="Double-click to reset"
                      />
                      <div className="absolute inset-0 flex items-center pointer-events-none z-20">
                         {[45, 90, 135, 180, 225, 270, 315].map(deg => <div key={deg} className={`absolute w-1 h-1 rounded-full -translate-x-1/2 transition-all duration-300 ${activeLayer.rotation === deg ? 'bg-pink-500 w-2 h-2' : 'bg-neutral-600'}`} style={{ left: `${(deg/360)*100}%` }} />)}
                      </div>
                  </div>
            </div>
          </CollapsibleSection>

          {/* Path Tool (Shift+6) */}
          <CollapsibleSection 
              title="Path Tool" 
              icon={Route} 
              isOpen={panelState.path}
              onToggle={() => togglePanel('path')}
          >
            {design.selectedLayerIds.length > 1 ? (
                 <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-[3px] text-center text-xs text-neutral-500 italic">
                     Select a single layer to use Path Tools.
                 </div>
            ) : (
                <>
                <div className="flex gap-2">
                    <button 
                        onClick={() => updateLayer('isPathInputMode', !activeLayer.isPathInputMode)}
                        disabled={activeLayer.isPathMoveMode}
                        className={`flex-1 py-2 px-3 rounded-[3px] flex items-center justify-center gap-2 text-xs font-medium border transition-all ${activeLayer.isPathInputMode ? 'bg-pink-500/10 text-pink-500 border-pink-500' : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900 disabled:opacity-50'}`}
                    >
                        <PenTool size={14} /> {activeLayer.isPathInputMode ? 'Drawing Active' : 'Draw Path'}
                    </button>

                    {activeLayer.pathPoints.length > 0 && (
                        <button 
                            onClick={() => updateLayer('isPathMoveMode', !activeLayer.isPathMoveMode)}
                            disabled={activeLayer.isPathInputMode}
                            className={`flex-1 py-2 px-3 rounded-[3px] flex items-center justify-center gap-2 text-xs font-medium border transition-all ${activeLayer.isPathMoveMode ? 'bg-pink-500/10 text-pink-500 border-pink-500' : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900 disabled:opacity-50'}`}
                        >
                            <Move size={14} /> Modify Path
                        </button>
                    )}

                    {activeLayer.pathPoints.length > 0 && (
                        <button 
                            onClick={() => {
                                if (!design.activeLayerId) return;
                                setDesign(prev => ({
                                    ...prev,
                                    layers: prev.layers.map(l => l.id === prev.activeLayerId ? { 
                                        ...l, 
                                        pathPoints: [], 
                                        isPathMoveMode: false,
                                        isPathInputMode: false 
                                    } : l)
                                }));
                            }}
                            className="w-10 flex items-center justify-center rounded-[3px] bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-red-400 hover:border-red-400/50 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>

                {activeLayer.pathPoints.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800/50 animate-in slide-in-from-top-2 fade-in">
                        <SliderControl label="Smoothing" icon={Activity} value={activeLayer.pathSmoothing} setValue={(v) => updateLayer('pathSmoothing', v)} min="0" max="200" step="1" defaultValue={5} />
                    </div>
                )}
                </>
            )}
          </CollapsibleSection>

          {/* Effects (Shift+7) */}
          <EffectsControls 
            design={design} 
            update={(k, v) => updateLayer(k as keyof TextLayer, v)} 
            toggle={(k) => toggleLayer(k as keyof TextLayer)}
            isOpen={panelState.effects}
            onToggle={() => togglePanel('effects')}
          />

          {/* Blending (Shift+8) */}
          <CollapsibleSection 
            title="Blending" 
            icon={BoxSelect} 
            isOpen={panelState.blending}
            onToggle={() => togglePanel('blending')}
          >
            <div className="relative w-full">
              <select 
                className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] py-2 px-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors appearance-none cursor-pointer"
                value={activeLayer.blendMode}
                onChange={(e) => updateLayer('blendMode', e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply (Darken)</option>
                <option value="screen">Screen (Lighten)</option>
                <option value="overlay">Overlay (Contrast)</option>
                <option value="darken">Darken</option>
                <option value="lighten">Lighten</option>
                <option value="color-dodge">Color Dodge</option>
                <option value="color-burn">Color Burn</option>
                <option value="hard-light">Hard Light</option>
                <option value="soft-light">Soft Light</option>
                <option value="difference">Difference</option>
                <option value="exclusion">Exclusion</option>
                <option value="hue">Hue</option>
                <option value="saturation">Saturation</option>
                <option value="color">Color</option>
                <option value="luminosity">Luminosity</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            </div>
            
            <div className="pt-3">
                 <SliderControl label="Opacity" value={activeLayer.opacity * 100} setValue={(v) => updateLayer('opacity', v / 100)} min="0" max="100" step="1" suffix="%" defaultValue={100} />
            </div>
          </CollapsibleSection>
        </div>
        ) : (
            <div className="p-8 text-center text-neutral-500 text-sm">
                {!hasImage ? "Generate or upload an image to start designing layers." : "Select a layer to edit properties."}
            </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-6 border-t border-neutral-800 bg-neutral-950 shrink-0 z-10">
        <button onClick={onDownload} className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] font-medium flex items-center justify-center gap-2 transition-colors">
            <Download size={16} /> Save Image
        </button>
      </div>

      <ConfirmationModal 
        isOpen={!!layerToDelete}
        onClose={() => setLayerToDelete(null)}
        onConfirm={confirmDeleteLayer}
        title="Delete Layer"
        message="Are you sure you want to delete this layer? This action cannot be undone."
      />
      
      {activeLayer && (
        <FontBookModal 
            isOpen={isFontBookOpen}
            onClose={() => setIsFontBookOpen(false)}
            onSelect={(font) => updateLayer('fontFamily', font)}
            currentFont={activeLayer.fontFamily}
        />
      )}
    </div>
  );
});

// Helper for displaying hostname
const tryGetHostname = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
};

export default Controls;
