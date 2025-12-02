
import { FontFamily } from './types';

export const FONT_CATEGORIES = {
  SANS: 'Sans Serif',
  SERIF: 'Serif',
  DISPLAY: 'Display',
  HANDWRITING: 'Handwriting',
  MONO: 'Monospace',
  ALIEN: 'Alien / Sci-Fi'
};

export const FONTS: FontFamily[] = [
  'Abril Fatface', 'Alfa Slab One', 'Amatic SC', 'Anton', 'Audiowide', 'Bangers', 'Bebas Neue', 'Bodoni Moda', 'Bungee Shade', 'Butcherman', 'Cinzel',
  'Cormorant Garamond', 'Creepster', 'Crimson Text', 'DM Serif Display', 'Dancing Script', 'Eater', 'Eduardo Tunni', 'Fascinate Inline', 'Finger Paint', 'Fira Code',
  'Frijole', 'Gloria Hallelujah', 'Great Vibes', 'Inter', 'Italiana', 'Josefin Sans', 'Lato', 'League Gothic', 'Libre Baskerville',
  'Lobster', 'Lora', 'Megrim', 'Merriweather', 'Metal Mania', 'Michroma', 'Monoton', 'Montserrat', 'Nosifer', 'Noto Sans', 'Open Sans', 'Orbitron', 'Oswald',
  'PT Sans', 'PT Serif', 'Pacifico', 'Permanent Marker', 'Piedra', 'Plaster', 'Playfair Display', 'Poiret One', 'Poppins', 'Press Start 2P', 'Quantico', 'Raleway', 'Righteous',
  'Roboto', 'Rock Salt', 'Rubik Beastly', 'Rubik Glitch', 'Rye', 'Sancreek', 'Shadows Into Light', 'Shojumaru', 'Source Sans 3', 'Space Grotesque', 'Space Mono', 'Special Elite', 'Syne',
  'Turret Road', 'Unbounded', 'UnifrakturMaguntia', 'VT323', 'Wallpoet', 'Zen Dots'
];

// Helper to map fonts to categories
export const getFontCategory = (font: FontFamily): string => {
  const map: Record<string, string[]> = {
    [FONT_CATEGORIES.SANS]: [
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Oswald', 
        'Noto Sans', 'Source Sans 3', 'PT Sans', 'Josefin Sans', 'Anton', 'Bebas Neue', 
        'League Gothic', 'Space Grotesque', 'Unbounded', 'Syne', 'Quantico'
    ],
    [FONT_CATEGORIES.SERIF]: [
        'Merriweather', 'Playfair Display', 'Lora', 'PT Serif', 'Crimson Text', 
        'Libre Baskerville', 'Bodoni Moda', 'Cinzel', 'Cormorant Garamond', 
        'DM Serif Display', 'Abril Fatface', 'Italiana'
    ],
    [FONT_CATEGORIES.HANDWRITING]: [
        'Dancing Script', 'Pacifico', 'Shadows Into Light', 'Amatic SC', 
        'Gloria Hallelujah', 'Permanent Marker', 'Great Vibes', 'Rock Salt', 
        'Finger Paint', 'Lobster', 'Eduardo Tunni'
    ],
    [FONT_CATEGORIES.MONO]: [
        'Fira Code', 'Space Mono', 'VT323'
    ],
    [FONT_CATEGORIES.ALIEN]: [
        'Audiowide', 'Orbitron', 'Michroma', 'Turret Road', 'Zen Dots', 'Megrim', 
        'Press Start 2P', 'Wallpoet', 'Rubik Glitch', 'Rubik Beastly', 'Frijole', 
        'Butcherman', 'Creepster', 'Eater', 'Metal Mania', 'Nosifer', 'Piedra', 'Sancreek'
    ],
    [FONT_CATEGORIES.DISPLAY]: [
        'Alfa Slab One', 'Bangers', 'Bungee Shade', 'Fascinate Inline', 'Monoton', 
        'Plaster', 'Poiret One', 'Righteous', 'Shojumaru', 'Special Elite', 
        'UnifrakturMaguntia', 'Rye'
    ]
  };

  for (const [category, fonts] of Object.entries(map)) {
    if (fonts.includes(font)) return category;
  }
  return FONT_CATEGORIES.DISPLAY; // Fallback
};
