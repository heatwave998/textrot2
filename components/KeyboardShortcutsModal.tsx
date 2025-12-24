import React, { useEffect } from 'react';
import { Keyboard, X, ArrowUp, ArrowRight, ArrowDown, ArrowLeft } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutRow = ({ keys, label, separator = '+' }: { keys: React.ReactNode[], label: string, separator?: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
    <span className="text-sm text-neutral-400">{label}</span>
    <div className="flex items-center gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          <kbd className="min-w-[24px] px-1.5 h-6 flex items-center justify-center bg-neutral-800 border border-neutral-700 rounded text-[10px] font-mono text-neutral-300 shadow-sm">
            {k}
          </kbd>
          {i < keys.length - 1 && <span className="text-neutral-600 text-[10px]">{separator}</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Platform Detection
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';
  const altKey = isMac ? '⌥' : 'Alt';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      <div className="relative bg-neutral-900 w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl border border-neutral-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-950 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-pink-500 border border-neutral-700">
                <Keyboard size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
                <p className="text-xs text-neutral-400">Power user controls</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-white transition-colors hover:bg-neutral-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* General */}
            <div>
                <h4 className="text-xs font-bold text-pink-500 uppercase tracking-wider mb-3">General</h4>
                <ShortcutRow keys={['?']} label="Show Shortcuts" />
                <ShortcutRow keys={[modKey, 'Z']} label="Undo" />
                <ShortcutRow keys={[modKey, 'Shift', 'Z']} label="Redo" />

                <h4 className="text-xs font-bold text-pink-500 uppercase tracking-wider mb-3 mt-6">File Actions</h4>
                <ShortcutRow keys={[altKey, 'N']} label="New Blank Canvas" />
                <ShortcutRow keys={[altKey, 'U']} label="Upload Image" />
                <ShortcutRow keys={[altKey, 'L']} label="Load from URL" />
            </div>

            {/* Layer Controls */}
            <div>
                <h4 className="text-xs font-bold text-pink-500 uppercase tracking-wider mb-3">Layer Nudging</h4>
                <ShortcutRow 
                  keys={[
                    <ArrowUp size={12}/>, 
                    <ArrowDown size={12}/>, 
                    <ArrowLeft size={12}/>, 
                    <ArrowRight size={12}/>
                  ]} 
                  label="Nudge" 
                  separator=","
                />
                <ShortcutRow keys={['Shift', 'Arrows']} label="Large Nudge" />
                <ShortcutRow keys={[altKey, 'Arrows']} label="Precision Nudge" />
            </div>

            {/* Panels */}
            <div className="md:col-span-2">
                <h4 className="text-xs font-bold text-pink-500 uppercase tracking-wider mb-3">Panel Navigation</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                    <ShortcutRow keys={['Shift', '~']} label="Toggle All Panels" />
                    <ShortcutRow keys={['Shift', '0']} label="Generator Panel" />
                    <ShortcutRow keys={['Shift', '1']} label="Layers Panel" />
                    <ShortcutRow keys={['Shift', '2']} label="Content Panel" />
                    <ShortcutRow keys={['Shift', '3']} label="Typography Panel" />
                    <ShortcutRow keys={['Shift', '4']} label="Appearance Panel" />
                    <ShortcutRow keys={['Shift', '5']} label="Transform Panel" />
                    <ShortcutRow keys={['Shift', '6']} label="Path Tools" />
                    <ShortcutRow keys={['Shift', '7']} label="Effects Panel" />
                    <ShortcutRow keys={['Shift', '8']} label="Blending Panel" />
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-center text-[10px] text-neutral-600">
            Press <span className="font-mono text-neutral-400">ESC</span> to close
        </div>

      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;