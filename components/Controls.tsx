import React from 'react';
import { DesignState, FontFamily, AspectRatio, SpecialEffect } from '../types';
import { 
  Type, Palette, Layers, Download, Sparkles, 
  Bold, Italic, CaseUpper, FlipHorizontal, FlipVertical, 
  RotateCw, CircleDashed, Square, Settings, FilePlus, ImagePlus,
  Ban, Compass, ToggleRight, ToggleLeft, Paintbrush,
  Monitor, Smartphone, AlignCenterHorizontal, PenTool, Trash2, Route,
  AlignLeft, AlignCenter, AlignRight, Move, Activity,
  Maximize, MoveHorizontal, MoveVertical, Undo2, Redo2
} from 'lucide-react';

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
  'Abril Fatface',
  'Alfa Slab One',
  'Amatic SC',
  'Anton',
  'Bangers',
  'Bebas Neue',
  'Bodoni Moda',
  'Cinzel',
  'Cormorant Garamond',
  'Crimson Text',
  'DM Serif Display',
  'Dancing Script',
  'Eduardo Tunni',
  'Fira Code',
  'Gloria Hallelujah',
  'Great Vibes',
  'Inter',
  'Italiana',
  'Josefin Sans',
  'Lato',
  'League Gothic',
  'Libre Baskerville',
  'Lobster',
  'Lora',
  'Merriweather',
  'Monoton',
  'Montserrat',
  'Noto Sans',
  'Open Sans',
  'Orbitron',
  'Oswald',
  'PT Sans',
  'PT Serif',
  'Pacifico',
  'Permanent Marker',
  'Playfair Display',
  'Poppins',
  'Raleway',
  'Righteous',
  'Roboto',
  'Rubik Glitch',
  'Shadows Into Light',
  'Source Sans 3',
  'Space Grotesque',
  'Space Mono',
  'Syne',
  'Unbounded',
  'VT323'
];

const RATIOS: AspectRatio[] = ['1:1', '4:3', '3:2', '16:9'];

const SliderControl = ({ 
  label, 
  icon: Icon, 
  value, 
  setValue, 
  min, 
  max, 
  step,
  suffix = '',
  title = ''
}: any) => (
  <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-neutral-500 flex items-center gap-1.5">
              {Icon && <Icon size={12} />}
              {label}
          </label>
          <span className="text-[10px] text-neutral-500 font-mono">{Math.round(value)}{suffix}</span>
      </div>
      <div className="h-5 flex items-center">
          <input 
              type="range" min={min} max={max} step={step}
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white hover:bg-neutral-700 transition-colors"
              title={title}
          />
      </div>
  </div>
);

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
  vibeReasoning,
  hasImage
}) => {

  const update = (key: keyof DesignState, value: any) => {
    setDesign(prev => ({ ...prev, [key]: value }));
  };

  const toggle = (key: keyof DesignState) => {
    setDesign(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to display flipped ratio label in UI if Portrait
  const getRatioLabel = (ratio: AspectRatio) => {
      if (design.orientation === 'portrait') {
          const [w, h] = ratio.split(':');
          return `${h}:${w}`;
      }
      return ratio;
  };

  const handleClearPath = () => {
      setDesign(prev => ({ ...prev, pathPoints: [], isPathMoveMode: false }));
  };

  const handleTogglePathMode = () => {
      setDesign(prev => ({ 
          ...prev, 
          isPathInputMode: !prev.isPathInputMode,
          isPathMoveMode: false // Turn off move mode if drawing
      }));
  };

  const handleToggleMoveMode = () => {
      setDesign(prev => ({
          ...prev,
          isPathMoveMode: !prev.isPathMoveMode,
          isPathInputMode: false // Turn off draw mode if moving
      }));
  };

  return (
    <div className="h-full flex flex-col bg-neutral-900 border-l border-neutral-800 overflow-hidden">
      
      {/* Header - Sticky / Fixed Top */}
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

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Generator */}
        <div className="p-6 border-b border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-neutral-200 uppercase tracking-wider">Image/Edit Prompt</label>
              <div className="flex items-center gap-1">
                <button 
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={`p-1 rounded-[3px] transition-colors ${canUndo ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-800 cursor-not-allowed'}`}
                    title="Undo Image Change"
                >
                    <Undo2 size={16} />
                </button>
                <button 
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`p-1 rounded-[3px] transition-colors ${canRedo ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-800 cursor-not-allowed'}`}
                    title="Redo Image Change"
                >
                    <Redo2 size={16} />
                </button>
              </div>
          </div>
          <textarea 
            className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-3 text-sm focus:outline-none focus:border-pink-500 transition-colors resize-y min-h-[6rem]"
            placeholder="e.g. A cyberpunk samurai in neon rain..."
            value={design.prompt}
            onChange={(e) => update('prompt', e.target.value)}
            title="Describe the image you want to generate or edit"
          />
          
          {/* Aspect Ratio Controls */}
          <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Aspect Ratio</label>
                  {/* Orientation Toggle */}
                  <div className="flex bg-neutral-950 p-0.5 rounded-[3px] border border-neutral-800">
                    <button
                        onClick={() => update('orientation', 'landscape')}
                        className={`px-2 py-1 rounded-[2px] text-[10px] transition-all ${
                            design.orientation === 'landscape'
                            ? 'bg-neutral-800 text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="Landscape"
                    >
                        <Monitor size={12} />
                    </button>
                    <button
                        onClick={() => update('orientation', 'portrait')}
                        className={`px-2 py-1 rounded-[2px] text-[10px] transition-all ${
                            design.orientation === 'portrait'
                            ? 'bg-neutral-800 text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="Portrait"
                    >
                        <Smartphone size={12} />
                    </button>
                  </div>
              </div>
              
              <div className="flex gap-1">
                  {RATIOS.map((ratio) => (
                      <button
                          key={ratio}
                          onClick={() => update('aspectRatio', ratio)}
                          className={`flex-1 py-2 rounded-[3px] text-xs font-medium border ${
                              design.aspectRatio === ratio
                              ? 'bg-neutral-800 text-pink-500 border-pink-500/50'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900'
                          }`}
                          title={`Set aspect ratio to ${getRatioLabel(ratio)}`}
                      >
                          {getRatioLabel(ratio)}
                      </button>
                  ))}
              </div>
          </div>

          <div className="flex gap-2">
              {/* Generate Button */}
              <button 
                onClick={onGenerate}
                disabled={isGenerating || !design.prompt.trim()}
                className={`flex-1 py-3 rounded-[3px] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isGenerating || !design.prompt.trim()
                  ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-70' 
                  : 'bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:brightness-110 hover:shadow-pink-500/20'
                }`}
                title={!design.prompt.trim() ? "Please enter a prompt" : "Generate new image"}
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate
                  </>
                )}
              </button>

              {/* Edit Button */}
              <button
                onClick={onEdit}
                disabled={isGenerating || !hasImage || !design.prompt.trim()}
                className={`w-12 rounded-[3px] font-bold text-sm flex items-center justify-center transition-all border ${
                    isGenerating || !hasImage || !design.prompt.trim()
                    ? 'bg-neutral-900 text-neutral-700 border-neutral-800 cursor-not-allowed'
                    : 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600'
                }`}
                title="Edit existing image using prompt"
              >
                  <Paintbrush size={18} />
              </button>

              {/* Blank Button */}
              <button
                  onClick={onBlank}
                  className="w-12 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] flex items-center justify-center"
                  title="Start with a blank transparent canvas"
              >
                  <FilePlus size={18} />
              </button>

              {/* Upload Button */}
              <button
                  onClick={onUpload}
                  className="w-12 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] flex items-center justify-center"
                  title="Upload local image"
              >
                  <ImagePlus size={18} />
              </button>
          </div>
        </div>

        {/* Typography Controls */}
        <div className="p-6 space-y-8">
          
          {/* Text Content */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-neutral-300">
              <Type size={16} />
              <span className="text-sm font-medium">Text Content</span>
            </div>
            <textarea 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-sm focus:border-pink-500 outline-none resize-y"
              rows={2}
              value={design.textOverlay}
              onChange={(e) => update('textOverlay', e.target.value)}
              title="Text to display"
            />
          </div>

          {/* Font & Styles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-neutral-300">
              <Palette size={16} />
              <span className="text-sm font-medium">Style</span>
            </div>
            
            <select 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-lg outline-none"
              value={design.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              style={{ fontFamily: design.fontFamily }}
              title="Select font family"
            >
              {FONTS.map(f => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>

            {/* Modifiers Toolbar */}
            <div className="flex gap-1 bg-neutral-950 rounded-[6px] p-1 border border-neutral-800">
                <button 
                  onClick={() => toggle('isBold')}
                  className={`flex-1 h-10 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${design.isBold ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                  title="Toggle Bold"
                >
                  <Bold size={18} strokeWidth={3} />
                </button>
                <button 
                  onClick={() => toggle('isItalic')}
                  className={`flex-1 h-10 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${design.isItalic ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                  title="Toggle Italic"
                >
                  <Italic size={18} />
                </button>
                <button 
                  onClick={() => toggle('isUppercase')}
                  className={`flex-1 h-10 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${design.isUppercase ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                  title="Toggle Uppercase"
                >
                  <CaseUpper size={28} />
                </button>
            </div>

            {/* Alignment & Flips (Using Icons) */}
            <div className="flex gap-2">
                  <div className="flex-1 flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800">
                      <button
                          onClick={() => update('textAlign', 'left')}
                          className={`flex-1 h-8 rounded-[3px] flex items-center justify-center ${design.textAlign === 'left' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
                          title="Align Left"
                      >
                          <AlignLeft size={16} />
                      </button>
                      <button
                          onClick={() => update('textAlign', 'center')}
                          className={`flex-1 h-8 rounded-[3px] flex items-center justify-center ${design.textAlign === 'center' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
                          title="Align Center"
                      >
                          <AlignCenter size={16} />
                      </button>
                      <button
                          onClick={() => update('textAlign', 'right')}
                          className={`flex-1 h-8 rounded-[3px] flex items-center justify-center ${design.textAlign === 'right' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
                          title="Align Right"
                      >
                          <AlignRight size={16} />
                      </button>
                  </div>
                  
                  <div className="flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800">
                      <button 
                          onClick={() => toggle('flipX')}
                          className={`h-8 w-8 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${design.flipX ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                          title="Flip horizontal"
                      >
                          <FlipHorizontal size={16} />
                      </button>
                      <button 
                          onClick={() => toggle('flipY')}
                          className={`h-8 w-8 rounded-[3px] hover:bg-neutral-800 flex items-center justify-center ${design.flipY ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                          title="Flip vertical"
                      >
                          <FlipVertical size={16} />
                      </button>
                  </div>
            </div>

            {/* Kerning / Letter Spacing */}
            <SliderControl 
                label="Kerning" 
                icon={AlignCenterHorizontal}
                value={design.letterSpacing}
                setValue={(v: number) => update('letterSpacing', v)}
                min="-20" max="100" step="1"
                suffix="px"
                title="Letter Spacing"
            />

            {/* Letter Rotation */}
             <SliderControl 
                label="Letter Rotate" 
                icon={RotateCw}
                value={design.letterRotation}
                setValue={(v: number) => update('letterRotation', v)}
                min="-180" max="180" step="1"
                suffix="°"
                title="Rotate individual letters"
            />

            {/* Size */}
            <SliderControl 
                label="Size" 
                icon={Maximize}
                value={design.textSize}
                setValue={(v: number) => update('textSize', v)}
                min="0.1" max="50" step="0.1"
                suffix="%"
                title="Text Scale"
            />

            {/* Position Grid */}
            <div className="grid grid-cols-2 gap-4">
                <SliderControl 
                    label="X Pos" 
                    icon={MoveHorizontal}
                    value={design.overlayPosition.x}
                    setValue={(v: number) => update('overlayPosition', { ...design.overlayPosition, x: v })}
                    min="0" max="100" step="1"
                    suffix="%"
                    title="Horizontal Position"
                />
                <SliderControl 
                    label="Y Pos" 
                    icon={MoveVertical}
                    value={100 - design.overlayPosition.y} // Display logic inverted for slider
                    setValue={(v: number) => update('overlayPosition', { ...design.overlayPosition, y: 100 - v })}
                    min="0" max="100" step="1"
                    suffix="%"
                    title="Vertical Position (Right = Up)"
                />
            </div>

            {/* Rotation */}
            <div>
                  <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                          <RotateCw size={12} />
                          Rotation
                      </label>
                      <span className="text-[10px] text-neutral-500 font-mono">{Math.round(design.rotation)}°</span>
                  </div>
                  
                  <div className="relative flex items-center h-5">
                      {/* Slider Input */}
                      <input 
                          type="range" min="0" max="360" step="1"
                          value={Math.round(design.rotation)}
                          onChange={(e) => {
                              let val = parseInt(e.target.value);
                              // Magnetic Snapping Logic
                              const snapPoints = [0, 90, 180, 270, 360];
                              const threshold = 15; // Degrees snap range
                              
                              for (const point of snapPoints) {
                                  if (Math.abs(val - point) <= threshold) {
                                      val = point;
                                      break;
                                  }
                              }
                              update('rotation', val);
                          }}
                          className="relative z-10 w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white block focus:outline-none hover:bg-neutral-700 transition-colors"
                          title="Rotation angle (Snaps at 90° intervals)"
                      />
                      
                      {/* Visual Detents (Overlay) */}
                      <div className="absolute inset-0 flex items-center pointer-events-none z-20">
                         {[90, 180, 270].map(deg => (
                            <div 
                               key={deg} 
                               className={`absolute w-1 h-1 rounded-full -translate-x-1/2 transition-all duration-300 ${design.rotation === deg ? 'bg-pink-500 w-2 h-2 shadow-[0_0_5px_rgba(236,72,153,0.8)]' : 'bg-neutral-600'}`}
                               style={{ left: `${(deg/360)*100}%` }}
                            />
                         ))}
                      </div>
                  </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-2">
              {/* Text Color Column */}
              <div>
                  {/* Enforce fixed height for header row to match toggle button height */}
                  <div className="flex items-center mb-1 h-9">
                      <label className="text-[10px] text-neutral-500 block">Text Color</label>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-10">
                      <input 
                          type="color" 
                          value={design.textColor}
                          onChange={(e) => update('textColor', e.target.value)}
                          className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                          title={design.specialEffect === 'gradient' ? "Start Color" : "Text Color"}
                      />
                      <span className="text-xs font-mono text-neutral-400">{design.textColor}</span>
                  </div>
              </div>
              
              {/* Shadow/Glow Column */}
              <div>
                  <div className="flex items-center justify-between mb-1 h-9">
                      <label className="text-[10px] text-neutral-500">Shadow/Glow</label>
                      <button 
                        onClick={() => toggle('hasShadow')} 
                        className="text-neutral-500 hover:text-pink-500 transition-colors focus:outline-none flex items-center justify-end"
                        title="Toggle Shadow"
                      >
                          {design.hasShadow ? <ToggleRight size={28} className="text-pink-500"/> : <ToggleLeft size={28}/>}
                      </button>
                  </div>
                  <div className={`flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-10 transition-opacity ${!design.hasShadow ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input 
                          type="color" 
                          value={design.shadowColor}
                          onChange={(e) => update('shadowColor', e.target.value)}
                          className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                          title="Choose shadow or glow color"
                      />
                      <span className="text-xs font-mono text-neutral-400">{design.shadowColor}</span>
                  </div>
              </div>
            </div>

            {/* Shadow Settings (Removed Opacity from here) */}
            <div className="space-y-2 pt-2">
                  {/* Shadow Controls */}
                  <div className={`transition-opacity space-y-4 pt-1 ${!design.hasShadow ? 'opacity-50 pointer-events-none' : ''}`}>
                      <SliderControl 
                          label="Shadow Blur" 
                          value={design.shadowBlur}
                          setValue={(v: number) => update('shadowBlur', v)}
                          min="0" max="100" step="1"
                      />
                      <SliderControl 
                          label="Shadow Offset" 
                          value={design.shadowOffset}
                          setValue={(v: number) => update('shadowOffset', v)}
                          min="0" max="100" step="1"
                      />
                      <SliderControl 
                          label="Shadow Angle" 
                          value={design.shadowAngle}
                          setValue={(v: number) => update('shadowAngle', v)}
                          min="0" max="360" step="1"
                          suffix="°"
                      />
                  </div>
            </div>
          </div>

          {/* Text Path Tool (Moved Here) */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-300">
              <Route size={16} />
              <span className="text-sm font-medium">Text Path Tool</span>
            </div>
            
            <div className="flex gap-2">
                {/* Draw Path Button */}
                <button 
                    onClick={handleTogglePathMode}
                    disabled={design.isPathMoveMode}
                    className={`flex-1 py-2 px-3 rounded-[3px] flex items-center justify-center gap-2 text-xs font-medium border transition-all ${
                        design.isPathInputMode 
                        ? 'bg-pink-500/10 text-pink-500 border-pink-500' 
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                >
                    <PenTool size={14} />
                    {design.isPathInputMode ? 'Drawing Active' : 'Draw Path'}
                </button>

                {/* Move Path Button */}
                {design.pathPoints.length > 0 && (
                    <button 
                        onClick={handleToggleMoveMode}
                        disabled={design.isPathInputMode}
                        className={`flex-1 py-2 px-3 rounded-[3px] flex items-center justify-center gap-2 text-xs font-medium border transition-all ${
                            design.isPathMoveMode 
                            ? 'bg-pink-500/10 text-pink-500 border-pink-500' 
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                        title="Move the existing path"
                    >
                        <Move size={14} />
                        Move Path
                    </button>
                )}

                {design.pathPoints.length > 0 && (
                     <button 
                        onClick={handleClearPath}
                        className="w-10 flex items-center justify-center rounded-[3px] bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-red-400 hover:border-red-400/50 transition-colors"
                        title="Clear Path (Revert to straight text)"
                     >
                         <Trash2 size={14} />
                     </button>
                )}
            </div>

            {/* Smoothing Slider (Only shows when path exists) */}
            {design.pathPoints.length > 0 && (
                <div className="pt-2 border-t border-neutral-800/50 animate-in slide-in-from-top-2 fade-in">
                    <SliderControl 
                        label="Smoothing" 
                        icon={Activity}
                        value={design.pathSmoothing}
                        setValue={(v: number) => update('pathSmoothing', v)}
                        min="0" max="200" step="1"
                        title="Smooth jagged edges in the path"
                    />
                </div>
            )}

            {design.isPathInputMode && (
                <p className="text-[10px] text-neutral-500">Click and drag on the image to draw a path.</p>
            )}
            {design.isPathMoveMode && (
                <p className="text-[10px] text-neutral-500">Drag anywhere to move the path.</p>
            )}
          </div>

          {/* Effects (Hollow / Outline / Special FX) */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-300">
                  <CircleDashed size={16} />
                  <span className="text-sm font-medium">Effects</span>
              </div>

              <div className="flex gap-2">
                  <button
                      onClick={() => toggle('isHollow')}
                      className={`flex-1 h-12 rounded-[3px] border transition-all flex flex-col items-center justify-center gap-1 ${
                          design.isHollow 
                          ? 'bg-neutral-800 border-pink-500 text-pink-500' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                      }`}
                      title="Toggle hollow style"
                  >
                      <CircleDashed size={20} strokeWidth={design.isHollow ? 2.5 : 1.5} />
                      <span className="text-[9px] uppercase font-bold tracking-wider">Hollow</span>
                  </button>

                  <button
                      onClick={() => toggle('hasOutline')}
                      className={`flex-1 h-12 rounded-[3px] border transition-all flex flex-col items-center justify-center gap-1 ${
                          design.hasOutline 
                          ? 'bg-neutral-800 border-pink-500 text-pink-500' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                      }`}
                      title="Toggle outline style"
                  >
                      <Square size={20} strokeWidth={design.hasOutline ? 3 : 1.5} />
                      <span className="text-[9px] uppercase font-bold tracking-wider">Outline</span>
                  </button>
              </div>

              {/* Special FX Selector */}
              <div className="grid grid-cols-4 gap-1 bg-neutral-950 p-1 rounded-[3px] border border-neutral-800 mt-2">
                  <button 
                    onClick={() => update('specialEffect', 'none')}
                    className={`p-2 h-12 rounded-[3px] flex items-center justify-center ${design.specialEffect === 'none' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}
                    title="No Effect"
                  >
                    <Ban size={24} />
                  </button>
                  <button 
                    onClick={() => update('specialEffect', 'glitch')}
                    className={`p-2 h-12 rounded-[3px] flex items-center justify-center ${design.specialEffect === 'glitch' ? 'bg-neutral-800 text-pink-500' : 'text-neutral-500 hover:text-white'}`}
                    title="Glitch"
                  >
                    {/* Custom Glitch Icon */}
                    <div className="relative font-bold text-2xl leading-none">
                        <span className="absolute -left-[5px] -top-[1px] text-red-500 mix-blend-screen opacity-80">A</span>
                        <span className="absolute -right-[5px] -bottom-[1px] text-cyan-500 mix-blend-screen opacity-80">A</span>
                        <span className="relative text-white">A</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => update('specialEffect', 'gradient')}
                    className={`p-2 h-12 rounded-[3px] flex items-center justify-center ${design.specialEffect === 'gradient' ? 'bg-neutral-800 text-violet-500' : 'text-neutral-500 hover:text-white'}`}
                    title="Gradient Fill"
                  >
                    {/* Custom Gradient Icon */}
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-white to-violet-500 border border-white/20"></div>
                  </button>
                  <button 
                    onClick={() => update('specialEffect', 'echo')}
                    className={`p-2 h-12 rounded-[3px] flex items-center justify-center ${design.specialEffect === 'echo' ? 'bg-neutral-800 text-cyan-500' : 'text-neutral-500 hover:text-white'}`}
                    title="Echo / Motion Trail"
                  >
                     {/* Custom Echo Icon */}
                     <div className="relative font-bold text-2xl leading-none">
                        <span className="absolute -left-[10px] top-0 opacity-10">A</span>
                        <span className="absolute -left-[7px] top-0 opacity-30">A</span>
                        <span className="absolute -left-[5px] top-0 opacity-50">A</span>
                        <span className="absolute -left-[2px] top-0 opacity-70">A</span>
                        <span className="relative">A</span>
                    </div>
                  </button>
              </div>

              {/* Dynamic Controls based on Selection */}
              {design.specialEffect !== 'none' && (
                <div className="bg-neutral-950 p-3 rounded-[3px] border border-neutral-800 animate-in slide-in-from-top-2 fade-in space-y-4">
                    
                    {/* Rainbow Toggle for Glitch */}
                    {design.specialEffect === 'glitch' && (
                        <div className="flex items-center justify-between mb-2">
                            <label className={`text-[10px] transition-all font-medium ${
                                design.isRainbowGlitch 
                                ? 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-transparent bg-clip-text font-bold' 
                                : 'text-neutral-500'
                            }`}>
                                Rainbow Mode
                            </label>
                            <button 
                                onClick={() => toggle('isRainbowGlitch')}
                                className={`text-xs px-2 py-1 rounded-[3px] border ${design.isRainbowGlitch ? 'bg-neutral-800 border-pink-500 text-pink-500' : 'border-neutral-800 text-neutral-500'}`}
                            >
                                {design.isRainbowGlitch ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    )}

                    {/* Intensity / Midpoint Slider */}
                    <SliderControl 
                        label={design.specialEffect === 'glitch' ? 'Offset' : design.specialEffect === 'gradient' ? 'Spread' : 'Distance'}
                        value={design.effectIntensity}
                        setValue={(v: number) => update('effectIntensity', v)}
                        min="0" max="100" step="1"
                    />
                    
                    {/* Angle/Direction Slider (Echo, Gradient, and Rainbow Glitch) */}
                    {(design.specialEffect === 'echo' || design.specialEffect === 'gradient' || (design.specialEffect === 'glitch' && design.isRainbowGlitch)) && (
                         <div className="w-full">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                                    <Compass size={12} />
                                    {design.specialEffect === 'gradient' ? "Gradient Angle" : "Direction"}
                                </label>
                                <span className="text-[10px] text-neutral-500 font-mono">{design.effectAngle}°</span>
                            </div>
                            <div className="h-5 flex items-center">
                                <input 
                                    type="range" min="0" max="360"
                                    value={design.effectAngle}
                                    onChange={(e) => update('effectAngle', parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white hover:bg-neutral-700 transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {/* Rainbow Specific Controls (Opacity & Blur) */}
                    {design.specialEffect === 'glitch' && design.isRainbowGlitch && (
                        <div className="pt-2 border-t border-neutral-800/50 space-y-4">
                            <SliderControl 
                                label="Rainbow Opacity" 
                                value={design.rainbowOpacity * 100}
                                setValue={(v: number) => update('rainbowOpacity', v / 100)}
                                min="0" max="100" step="1"
                                suffix="%"
                            />
                            <SliderControl 
                                label="Rainbow Blur" 
                                value={design.rainbowBlur}
                                setValue={(v: number) => update('rainbowBlur', v)}
                                min="0" max="50" step="1"
                                suffix="px"
                            />
                        </div>
                    )}

                    {/* Secondary Color (Glitch or Gradient) */}
                    {(design.specialEffect === 'glitch' || design.specialEffect === 'gradient') && !design.isRainbowGlitch && (
                        <div>
                            <label className="text-[10px] text-neutral-500 block mb-1">
                                {design.specialEffect === 'gradient' ? 'End Color' : 'Glitch Colors'}
                            </label>
                            <div className="flex gap-2">
                                {/* Primary Effect Color (Left Glitch / Gradient End) */}
                                <div className="flex-1 flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1">
                                    <input 
                                        type="color" 
                                        value={design.effectColor}
                                        onChange={(e) => update('effectColor', e.target.value)}
                                        className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                                    />
                                </div>
                                
                                {/* Secondary Effect Color (Right Glitch - Only for Glitch) */}
                                {design.specialEffect === 'glitch' && (
                                    <div className="flex-1 flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1">
                                        <input 
                                            type="color" 
                                            value={design.effectColor2}
                                            onChange={(e) => update('effectColor2', e.target.value)}
                                            className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
              )}

              {/* Outline Config */}
              {design.hasOutline && (
                  <div className="bg-neutral-950 p-3 rounded-[3px] border border-neutral-800 animate-in slide-in-from-top-2 fade-in grid grid-cols-2 gap-2">
                      <div>
                          <label className="text-[10px] text-neutral-500 block mb-1">Width (px)</label>
                          <div className="bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-[34px] flex items-center">
                              <input 
                                  type="number" 
                                  min="0.1" max="50" step="0.1"
                                  value={design.outlineWidth}
                                  onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val)) {
                                          update('outlineWidth', val);
                                      }
                                  }}
                                  className="w-full bg-transparent text-xs text-center focus:outline-none"
                                  title="Outline thickness in pixels"
                              />
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] text-neutral-500 block mb-1">Outline Color</label>
                          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-[34px]">
                              <input 
                                  type="color" 
                                  value={design.outlineColor}
                                  onChange={(e) => update('outlineColor', e.target.value)}
                                  className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                                  title="Outline color"
                              />
                              <span className="text-xs font-mono text-neutral-400">{design.outlineColor}</span>
                          </div>
                      </div>
                  </div>
              )}
          </div>

          {/* Blend Mode */}
          <div className="space-y-3 pt-2 border-t border-neutral-800 pb-6">
            <div className="flex items-center gap-2 text-neutral-300">
              <Layers size={16} />
              <span className="text-sm font-medium">Blending</span>
            </div>
            <select 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-sm outline-none"
              value={design.blendMode}
              onChange={(e) => update('blendMode', e.target.value)}
              title="Select blend mode"
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
            
            {/* Opacity Slider */}
            <SliderControl 
                label="Opacity" 
                value={design.opacity * 100}
                setValue={(v: number) => update('opacity', v / 100)}
                min="0" max="100" step="1"
                suffix="%"
            />
          </div>
        </div>

      </div>

      {/* Footer Actions - Sticky / Fixed Bottom */}
      <div className="p-6 border-t border-neutral-800 bg-neutral-950 shrink-0 z-10">
        <button 
            onClick={onDownload}
            className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] font-medium flex items-center justify-center gap-2 transition-colors"
            title="Save high-resolution image"
        >
            <Download size={16} />
            Save Image
        </button>
      </div>
    </div>
  );
};

export default Controls;