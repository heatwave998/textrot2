import React from 'react';
import { DesignState } from '../types';
import { CircleDashed, Square, Ban, Compass } from 'lucide-react';
import SliderControl from './SliderControl';

interface EffectsControlsProps {
  design: DesignState;
  update: (key: keyof DesignState, value: any) => void;
  toggle: (key: keyof DesignState) => void;
}

const EffectsControls: React.FC<EffectsControlsProps> = ({ design, update, toggle }) => {
  return (
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
  );
};

export default EffectsControls;