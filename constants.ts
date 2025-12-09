

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

// Variable Font Axis Definition
export interface FontAxis {
  tag: string;       // e.g. 'wght', 'wdth', 'WONK'
  name: string;      // e.g. 'Weight', 'Width', 'Wonkiness'
  min: number;
  max: number;
  defaultValue: number;
  step: number;
}

export interface VariableFontConfig {
  axes: FontAxis[];
}

// Registry of known variable capabilities for fonts in our library
// Note: This matches the Google Fonts variable axes ranges where applicable.
export const VARIABLE_FONTS: Partial<Record<FontFamily, VariableFontConfig>> = {
  'Bodoni Moda': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 400, max: 900, defaultValue: 400, step: 1 },
      // Italic is usually a toggle, but Bodoni Moda variable axes includes 'opsz' in some versions, 
      // though Google Fonts mainly exposes wght and ital.
    ]
  },
  'Inter': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 10 },
      // slnt is -10 to 0 on Inter variable, but our static import might only snap to specific weights.
      // We expose it for robustness.
    ]
  },
  'Josefin Sans': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 700, defaultValue: 400, step: 1 }
    ]
  },
  'Lora': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 400, max: 700, defaultValue: 400, step: 1 }
    ]
  },
  'Merriweather': {
    axes: [
       { tag: 'wght', name: 'Weight', min: 300, max: 900, defaultValue: 400, step: 1 }
    ]
  },
  'Montserrat': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 10 }
    ]
  },
  'Noto Sans': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1 },
      { tag: 'wdth', name: 'Width', min: 62.5, max: 100, defaultValue: 100, step: 0.1 }
    ]
  },
  'Open Sans': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 300, max: 800, defaultValue: 400, step: 1 },
      { tag: 'wdth', name: 'Width', min: 75, max: 100, defaultValue: 100, step: 0.1 }
    ]
  },
  'Oswald': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 200, max: 700, defaultValue: 400, step: 1 }
    ]
  },
  'Playfair Display': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 400, max: 900, defaultValue: 400, step: 1 }
    ]
  },
  'Raleway': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1 }
    ]
  },
  'Roboto': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 10 },
      { tag: 'wdth', name: 'Width', min: 75, max: 100, defaultValue: 100, step: 0.1 }
    ]
  },
  'Source Sans 3': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 200, max: 900, defaultValue: 400, step: 1 }
    ]
  },
  'Space Grotesque': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 300, max: 700, defaultValue: 400, step: 1 }
    ]
  },
  'Unbounded': {
     axes: [
       { tag: 'wght', name: 'Weight', min: 200, max: 900, defaultValue: 400, step: 1 }
     ]
  },
  'Fira Code': {
    axes: [
       { tag: 'wght', name: 'Weight', min: 300, max: 700, defaultValue: 400, step: 1 }
    ]
  }
};


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