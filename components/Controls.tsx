
import React, { useState } from 'react';
import { DesignState, FontFamily, AspectRatio, TextLayer } from '../types';
import { 
  Type, Palette, Layers, Download, Sparkles, 
  Bold, Italic, CaseUpper, FlipHorizontal, FlipVertical, 
  RotateCw, Settings, FilePlus, ImagePlus,
  Monitor, Smartphone, AlignCenterHorizontal, PenTool, Trash2, Route,
  AlignLeft, AlignCenter, AlignRight, Move, Activity,
  Maximize, MoveHorizontal, MoveVertical, Undo2, Redo2, ToggleRight, ToggleLeft, Paintbrush,
  Plus, Eye, EyeOff, ChevronUp, ChevronDown, Wand2, BoxSelect
} from 'lucide-react';
import SliderControl from './SliderControl';
import EffectsControls from './EffectsControls';
import ConfirmationModal from './ConfirmationModal';
import CollapsibleSection from './CollapsibleSection';
import { useIsKeyPressed } from '../hooks/useKeyboard';

interface ControlsProps {
  design: DesignState;
  setDesign: React.Dispatch<React.SetStateAction<DesignState>>;
  onGenerate: () => void;
  onEdit: () => void;
  onBlank: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onOpenSettings: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isGenerating: boolean;
  vibeReasoning: string | null;
  hasImage: boolean;
}

const FONTS: FontFamily[] = [
  'Abril Fatface', 'Alfa Slab One', 'Amatic SC', 'Anton', 'Bangers', 'Bebas Neue', 'Bodoni Moda', 'Cinzel',
  'Cormorant Garamond', 'Crimson Text', 'DM Serif Display', 'Dancing Script', 'Eduardo Tunni', 'Fira Code',
  'Gloria Hallelujah', 'Great Vibes', 'Inter', 'Italiana', 'Josefin Sans', 'Lato', 'League Gothic', 'Libre Baskerville',
  'Lobster', 'Lora', 'Merriweather', 'Monoton', 'Montserrat', 'Noto Sans', 'Open Sans', 'Orbitron', 'Oswald',
  'PT Sans', 'PT Serif', 'Pacifico', 'Permanent Marker', 'Playfair Display', 'Poppins', 'Raleway', 'Righteous',
  'Roboto', 'Rubik Glitch', 'Shadows Into Light', 'Source Sans 3', 'Space Grotesque', 'Space Mono', 'Syne',
  'Unbounded', 'VT323'
];

const RATIOS: AspectRatio[] = ['1:1', '4:3', '3:2', '16:9'];

const Controls: React.FC<ControlsProps> = ({ 
  design, 
  setDesign, 
  onGenerate, 
  onEdit,
  onBlank,
  onUpload,
  onDownload,
  onOpenSettings,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isGenerating,
  hasImage
}) => {
  const [layerToDelete, setLayerToDelete] = useState<string | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);

  // Keyboard States
  const isShiftPressed = useIsKeyPressed('Shift');
  const isAltPressed = useIsKeyPressed('Alt');
  const isGranularMode = (isShiftPressed || isAltPressed);

  // Global State Updates
  const updateGlobal = (key: keyof DesignState, value: any) => {
    setDesign(prev => ({ ...prev, [key]: value }));
  };

  // Active Layer Updates
  const activeLayer = design.layers.find(l => l.id === design.activeLayerId);
  
  const updateLayer = (key: keyof TextLayer, value: any) => {
    if (!design.activeLayerId) return;
    setDesign(prev => ({
        ...prev,
        layers: prev.layers.map(l => l.id === prev.activeLayerId ? { ...l, [key]: value } : l)
    }));
  };

  const toggleLayer = (key: keyof TextLayer) => {
    if (!activeLayer) return;
    updateLayer(key, !activeLayer[key]);
  };

  const updatePosition = (axis: 'x' | 'y', value: number) => {
      if (!activeLayer) return;
      updateLayer('overlayPosition', { ...activeLayer.overlayPosition, [axis]: value });
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
        rotation: 0,
        flipX: false,
        flipY: false
      };
      
      setDesign(prev => ({
          ...prev,
          layers: [...prev.layers, newLayer],
          activeLayerId: newId
      }));
  };

  const handleDeleteLayer = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setLayerToDelete(id);
  };

  const confirmDeleteLayer = () => {
      if (!layerToDelete) return;

      setDesign(prev => {
          const newLayers = prev.layers.filter(l => l.id !== layerToDelete);
          return {
              ...prev,
              layers: newLayers,
              activeLayerId: newLayers.length > 0 ? newLayers[newLayers.length - 1].id : null
          };
      });
      setLayerToDelete(null);
  };

  const handleToggleVisible = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDesign(prev => ({
          ...prev,
          layers: prev.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
      }));
  };

  const moveLayer = (id: string, direction: 'forward' | 'backward', e: React.MouseEvent) => {
      e.stopPropagation();
      setDesign(prev => {
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

  return (
    <div className="h-full flex flex-col bg-neutral-900 border-l border-neutral-800 overflow-hidden">
      
      {/* Header */}
      <div className="p-6 border-b border-neutral-800 flex items-start justify-between bg-neutral-900 shrink-0 z-10">
        <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500 mb-1">
            ///textrot studio
            </h2>
            <p className="text-xs text-neutral-400">
            Visuals by Gemini 3 Pro.<br/>Typography by You.
            </p>
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
        <CollapsibleSection title="Image Generator" icon={Wand2} defaultOpen={true}>
          <div className="space-y-4 pt-1">
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

            <div className="flex gap-2">
                <button 
                  onClick={onGenerate}
                  disabled={isGenerating || !design.prompt.trim()}
                  className={`flex-1 py-3 rounded-[3px] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${isGenerating || !design.prompt.trim() ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:brightness-110 hover:shadow-pink-500/20'}`}
                >
                  {isGenerating ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></span> : <><Sparkles size={16} /> Generate</>}
                </button>
                <button onClick={onEdit} disabled={isGenerating || !hasImage || !design.prompt.trim()} className={`w-12 rounded-[3px] font-bold text-sm flex items-center justify-center transition-all border ${isGenerating || !hasImage || !design.prompt.trim() ? 'bg-neutral-900 text-neutral-700 border-neutral-800 cursor-not-allowed' : 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700'}`}> <Paintbrush size={18} /> </button>
                <button onClick={onBlank} className="w-12 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] flex items-center justify-center"> <FilePlus size={18} /> </button>
                <button onClick={onUpload} className="w-12 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] flex items-center justify-center"> <ImagePlus size={18} /> </button>
            </div>
          </div>
        </CollapsibleSection>

        {/* Layers Section */}
        <CollapsibleSection title="Layers" icon={Layers} defaultOpen={true}>
            <div className={`transition-all duration-300 ${!hasImage ? 'opacity-40 pointer-events-none filter grayscale' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-neutral-500">
                        Manage Stacking Order
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

                        return (
                        <div 
                            key={layer.id}
                            onClick={() => updateGlobal('activeLayerId', layer.id)}
                            className={`flex items-center justify-between p-2 text-xs border-b border-neutral-800 last:border-0 cursor-pointer group ${layer.id === design.activeLayerId ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900'}`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                 <span className="font-mono opacity-50 select-none">T</span>
                                 <span className="truncate max-w-[120px]">{layer.textOverlay || 'Empty Text'}</span>
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
            </div>
        </CollapsibleSection>

        {hasImage && activeLayer ? (
        <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 pb-12">
          
          {/* Text Content */}
          <CollapsibleSection title="Text Content" icon={Type} defaultOpen={true}>
            <textarea 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-sm focus:border-pink-500 outline-none resize-y"
              rows={2}
              value={activeLayer.textOverlay}
              onChange={(e) => updateLayer('textOverlay', e.target.value)}
            />
          </CollapsibleSection>

          {/* Typography */}
          <CollapsibleSection title="Typography" icon={Palette} defaultOpen={true}>
            <select 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-lg outline-none"
              value={activeLayer.fontFamily}
              onChange={(e) => updateLayer('fontFamily', e.target.value)}
              style={{ fontFamily: activeLayer.fontFamily }}
            >
              {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>

            <div className="flex gap-1 bg-neutral-950 rounded-[6px] p-1 border border-neutral-800">
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
                      <button onClick={() => toggleLayer('flipX')} className={`h-8 w-8 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${activeLayer.flipX ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}><FlipHorizontal size={16} /></button>
                      <button onClick={() => toggleLayer('flipY')} className={`h-8 w-8 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${activeLayer.flipY ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}><FlipVertical size={16} /></button>
                  </div>
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

          {/* Appearance */}
          <CollapsibleSection title="Appearance" icon={Palette} defaultOpen={false}>
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

          {/* Transform */}
          <CollapsibleSection title="Transform" icon={Move} defaultOpen={false}>
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
                              const snapPoints = [0, 90, 180, 270, 360];
                              for (const point of snapPoints) if (Math.abs(val - point) <= 15) { val = point; break; }
                              updateLayer('rotation', val);
                          }}
                          onDoubleClick={() => updateLayer('rotation', 0)}
                          className="relative z-10 w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white block focus:outline-none hover:bg-neutral-700 transition-colors"
                          title="Double-click to reset"
                      />
                      <div className="absolute inset-0 flex items-center pointer-events-none z-20">
                         {[90, 180, 270].map(deg => <div key={deg} className={`absolute w-1 h-1 rounded-full -translate-x-1/2 transition-all duration-300 ${activeLayer.rotation === deg ? 'bg-pink-500 w-2 h-2' : 'bg-neutral-600'}`} style={{ left: `${(deg/360)*100}%` }} />)}
                      </div>
                  </div>
            </div>
          </CollapsibleSection>

          {/* Text Path Tool */}
          <CollapsibleSection title="Path Tool" icon={Route} defaultOpen={false}>
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
                        <Move size={14} /> Move Path
                    </button>
                )}

                {activeLayer.pathPoints.length > 0 && (
                     <button 
                        onClick={() => updateLayer('pathPoints', [])}
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
          </CollapsibleSection>

          <EffectsControls design={design} update={(k, v) => updateLayer(k as keyof TextLayer, v)} toggle={(k) => toggleLayer(k as keyof TextLayer)} />

          <CollapsibleSection title="Blending" icon={BoxSelect} defaultOpen={false}>
            <select 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-sm outline-none"
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
    </div>
  );
};

export default Controls;
