
import React, { useState, useMemo } from 'react';
import { X, Search, Type } from 'lucide-react';
import { FontFamily } from '../types';
import { FONTS, FONT_CATEGORIES, getFontCategory } from '../constants';

interface FontBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (font: FontFamily) => void;
  currentFont: FontFamily;
}

const FontBookModal: React.FC<FontBookModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  currentFont 
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', ...Object.values(FONT_CATEGORIES)];

  const filteredFonts = useMemo(() => {
    return FONTS.filter(font => {
      const matchesSearch = font.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || getFontCategory(font) === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Window */}
      <div className="relative bg-neutral-900 w-full h-full max-w-6xl rounded-lg shadow-2xl border border-neutral-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-neutral-800 bg-neutral-950 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-pink-500">
                <Type size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white tracking-wide">Type Studio</h2>
                <p className="text-xs text-neutral-500">Select a typeface for your layer</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 p-4 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                <input 
                    type="text" 
                    placeholder="Search fonts..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-pink-500 transition-colors"
                />
            </div>
            
            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                            activeCategory === cat 
                            ? 'bg-white text-black font-bold' 
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Font Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-neutral-900">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFonts.map(font => (
                    <button
                        key={font}
                        onClick={() => { onSelect(font); onClose(); }}
                        className={`
                            group relative aspect-[4/3] rounded-md border flex flex-col overflow-hidden transition-all duration-200
                            ${currentFont === font 
                                ? 'bg-neutral-800 border-pink-500 ring-1 ring-pink-500' 
                                : 'bg-neutral-950 border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900'
                            }
                        `}
                    >
                        {/* Preview Area */}
                        <div className="flex-1 flex items-center justify-center p-4 w-full overflow-hidden">
                            <span 
                                style={{ fontFamily: font }} 
                                className="text-4xl md:text-5xl text-white group-hover:scale-110 transition-transform duration-300"
                            >
                                Aa
                            </span>
                        </div>
                        
                        {/* Footer */}
                        <div className="h-10 border-t border-neutral-800/50 bg-neutral-950/50 flex items-center justify-between px-3 w-full shrink-0">
                            <span className="text-xs text-neutral-400 font-medium truncate pr-2">{font}</span>
                            {currentFont === font && <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />}
                        </div>
                    </button>
                ))}
                
                {filteredFonts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-neutral-500">
                        <p>No fonts found matching "{searchQuery}"</p>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default FontBookModal;
