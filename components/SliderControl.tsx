
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
  defaultValue?: number;
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
  title = '',
  defaultValue
}) => {
  const stepNum = Number(step);
  // If step is integer, round to integer. If decimal, show 2 decimal places.
  const displayValue = Number.isInteger(stepNum) ? Math.round(value) : value.toFixed(2);

  return (
    <div className="w-full">
        <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                {Icon && <Icon size={12} />}
                {label}
            </label>
            <span className="text-[10px] text-neutral-500 font-mono">{displayValue}{suffix}</span>
        </div>
        <div className="h-5 flex items-center">
            <input 
                type="range" min={min} max={max} step={step}
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value))}
                onDoubleClick={() => { if (defaultValue !== undefined) setValue(defaultValue); }}
                className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white hover:bg-neutral-700 transition-colors"
                title={title || (defaultValue !== undefined ? "Double-click to reset" : "")}
            />
        </div>
    </div>
  );
};

export default SliderControl;
