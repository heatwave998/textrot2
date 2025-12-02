

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
  'Cormorant Garamond', 'Creepster', 'Crimson Text', 'Diplomata', 'DM Serif Display', 'Dancing Script', 'DotGothic16', 'Eater', 'Eduardo Tunni', 'Ewert', 'Fascinate Inline', 'Finger Paint', 'Fira Code',
  'Foldit', 'Frijole', 'Geostar', 'Gloria Hallelujah', 'Great Vibes', 'Grenze Gotisch', 'Inter', 'Italiana', 'Jacquard 12', 'Jersey 10', 'Josefin Sans', 'Kablammo', 'Krona One', 'Lato', 'League Gothic', 'Libre Baskerville',
  'Lobster', 'Lora', 'Major Mono Display', 'Megrim', 'Merriweather', 'Metal Mania', 'Michroma', 'Micro 5', 'Monoton', 'Montserrat', 'Nosifer', 'Noto Sans', 'Oi', 'Open Sans', 'Orbitron', 'Oswald', 'Oxanium',
  'PT Sans', 'PT Serif', 'Pacifico', 'Permanent Marker', 'Piedra', 'Pixelify Sans', 'Plaster', 'Playfair Display', 'Poiret One', 'Poppins', 'Press Start 2P', 'Quantico', 'Raleway', 'Righteous',
  'Roboto', 'Rock Salt', 'Rubik 80s Fade', 'Rubik Beastly', 'Rubik Burned', 'Rubik Glitch', 'Rubik Iso', 'Rubik Marker Hatch', 'Rubik Microbe', 'Rubik Puddles', 'Rubik Wet Paint', 'Rye', 'Sancreek', 'Shadows Into Light', 'Share Tech Mono', 'Shojumaru', 'Silkscreen', 'Sixtyfour', 'Slackey', 'Smokum', 'Source Sans 3', 'Space Grotesque', 'Space Mono', 'Special Elite', 'Syne',
  'Turret Road', 'Unbounded', 'UnifrakturMaguntia', 'VT323', 'Vast Shadow', 'Wallpoet', 'Workbench', 'Zen Dots'
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
        'Press Start 2P', 'Wallpoet', 'Rubik Glitch', 'Rubik Beastly', 'Rubik Microbe', 'Rubik Wet Paint',
        'Frijole', 'Butcherman', 'Creepster', 'Eater', 'Metal Mania', 'Nosifer', 'Piedra', 'Sancreek',
        'Sixtyfour', 'Silkscreen', 'DotGothic16', 'Major Mono Display', 'Share Tech Mono', 'Oxanium', 
        'Krona One', 'Jacquard 12', 'Jersey 10', 'Pixelify Sans', 'Micro 5'
    ],
    [FONT_CATEGORIES.DISPLAY]: [
        'Alfa Slab One', 'Bangers', 'Bungee Shade', 'Fascinate Inline', 'Monoton', 
        'Plaster', 'Poiret One', 'Righteous', 'Shojumaru', 'Special Elite', 
        'UnifrakturMaguntia', 'Rye', 'Foldit', 'Kablammo', 'Rubik Iso', 'Rubik 80s Fade',
        'Rubik Burned', 'Rubik Marker Hatch', 'Rubik Puddles', 'Diplomata', 'Geostar', 
        'Ewert', 'Grenze Gotisch', 'Vast Shadow', 'Workbench', 'Slackey', 'Smokum', 'Oi'
    ]
  };

  for (const [category, fonts] of Object.entries(map)) {
    if (fonts.includes(font)) return category;
  }
  return FONT_CATEGORIES.DISPLAY; // Fallback
};
