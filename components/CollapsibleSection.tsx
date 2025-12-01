import React, { useState } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true,
  className = '',
  headerClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border-b border-neutral-800 ${className}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between py-4 px-6 hover:bg-neutral-800/30 transition-colors group focus:outline-none ${headerClassName}`}
      >
        <div className="flex items-center gap-2 text-neutral-400 group-hover:text-neutral-200 transition-colors">
          {Icon && <Icon size={16} />}
          <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
        </div>
        <div className={`text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} />
        </div>
      </button>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
         <div className="px-6 pb-6 space-y-4">
            {children}
         </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;