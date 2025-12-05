
import React from 'react';
import { AlertOctagon, X } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  message 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-red-500/30 w-full max-w-md rounded-lg shadow-2xl shadow-red-900/20 overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex items-start p-6 gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
                <AlertOctagon size={24} />
            </div>
            
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">{message}</p>
                
                {message.includes('Quota') && (
                    <div className="mt-4 p-3 bg-neutral-950 rounded border border-neutral-800 text-xs text-neutral-500">
                        <strong>Tip:</strong> You can use your own API Key in Settings for higher quotas, or switch to the Gemini Flash model which is faster and has higher limits.
                    </div>
                )}
            </div>

            <button 
                onClick={onClose}
                className="text-neutral-500 hover:text-white transition-colors -mr-2 -mt-2 p-2"
            >
                <X size={20} />
            </button>
        </div>

        <div className="bg-neutral-950/50 p-4 border-t border-neutral-800 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 hover:text-white text-neutral-300 rounded-[3px] text-sm font-medium transition-colors"
            >
                Dismiss
            </button>
        </div>

      </div>
    </div>
  );
};

export default ErrorModal;
