import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-[3px] w-full max-w-xs shadow-2xl transform transition-all scale-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
            <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-500">
                <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                {message}
            </p>
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={onClose}
                    className="py-2 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-[3px] text-sm font-medium transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={() => { onConfirm(); onClose(); }}
                    className="py-2 px-4 bg-pink-600 hover:bg-pink-500 text-white rounded-[3px] text-sm font-bold transition-colors shadow-lg shadow-pink-900/20"
                >
                    Confirm
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;