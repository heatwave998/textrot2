import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SliderControlProps {
  label: string;
  icon?: LucideIcon;
  value: number;
  setValue: (value: number) => void;
  min: number | string;
  max: number | string;
  step: number | string;
  suffix?: string;
  title?: string;
}

const SliderControl: React.FC<SliderControlProps> = ({ 
  label, 
  icon: Icon, 
  value, 
  setValue, 
  min, 
  max, 
  step,
  suffix = '',
  title = ''
}) => (
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

export default SliderControl;