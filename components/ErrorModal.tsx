
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  message,
  ctaLabel,
  onCta
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-[3px] w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button (Top Right) */}
        <button 
            onClick={onClose}
            className="absolute top-2 right-2 p-2 text-neutral-500 hover:text-white rounded-full transition-colors z-10"
        >
            <X size={16} />
        </button>

        <div className="p-6 text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <AlertTriangle size={24} />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed break-words">
                {message}
            </p>
            
            <div className={`grid ${ctaLabel ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                <button 
                    onClick={onClose}
                    className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-[3px] text-sm font-medium transition-colors"
                >
                    Close
                </button>
                
                {ctaLabel && onCta && (
                    <button 
                        onClick={() => { onCta(); onClose(); }}
                        className="py-2.5 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:brightness-110 text-white rounded-[3px] text-sm font-bold transition-all shadow-lg shadow-red-900/20"
                    >
                        {ctaLabel}
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
