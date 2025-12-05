
import React, { useState, useRef, useEffect } from 'react';
import { X, Link as LinkIcon, ArrowRight, Loader2 } from 'lucide-react';

interface UrlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string) => void;
}

const UrlImportModal: React.FC<UrlImportModalProps> = ({ 
  isOpen, 
  onClose, 
  onImport 
}) => {
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onImport(url);
    setUrl('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-pink-500 border border-neutral-700">
                        <LinkIcon size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Load from URL</h3>
                        <p className="text-xs text-neutral-400">Import an image directly from the web</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="relative">
                    <input 
                        ref={inputRef}
                        type="url" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-pink-500 transition-colors placeholder:text-neutral-700 font-mono"
                    />
                    <button 
                        type="submit"
                        disabled={!url.trim() || isValidating}
                        className="absolute right-1 top-1 bottom-1 aspect-square bg-neutral-800 hover:bg-pink-600 text-neutral-400 hover:text-white rounded-[2px] flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isValidating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    </button>
                </div>
            </form>
            
            <p className="mt-4 text-[10px] text-neutral-500 leading-relaxed">
                Supported formats: PNG, JPG, WEBP. Ensure the URL is publicly accessible and allows Cross-Origin requests (CORS), or drag a <strong>.webloc</strong> file directly onto the canvas.
            </p>
        </div>
      </div>
    </div>
  );
};

export default UrlImportModal;
