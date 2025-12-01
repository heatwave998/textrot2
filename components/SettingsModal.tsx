import React from 'react';
import { X, MousePointer2 } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSettingsChange 
}) => {
  if (!isOpen) return null;

  const toggleZoom = () => {
    onSettingsChange({ ...settings, enableZoom: !settings.enableZoom });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-sm shadow-2xl transform transition-all scale-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">Studio Settings</h2>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Option: Mouse Wheel Zoom */}
          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-[3px] ${settings.enableZoom ? 'bg-pink-500/10 text-pink-500' : 'bg-neutral-800 text-neutral-500'}`}>
                    <MousePointer2 size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-white">Canvas Zoom</h3>
                    <p className="text-xs text-neutral-500">Use scroll wheel to zoom in/out</p>
                </div>
            </div>
            
            {/* Toggle Switch */}
            <button 
                onClick={toggleZoom}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${settings.enableZoom ? 'bg-pink-500' : 'bg-neutral-700'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${settings.enableZoom ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

        </div>
        
        {/* Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 text-center">
            <p className="text-[10px] text-neutral-600">///textrot studio v1.0</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;