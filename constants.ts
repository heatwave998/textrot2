

import { FontFamily } from './types';

export const FONT_CATEGORIES = {
  SANS: 'Sans Serif',
  SERIF: 'Serif',
  DISPLAY: 'Display',
  HANDWRITING: 'Handwriting',
  MONO: 'Monospace',
  COLOR: 'Color',
  ALIEN: 'Alien / Sci-Fi',
  FANCY: 'Fancy',
  // New Categories
  DOT_MATRIX: 'Dot Matrix',
  LED: 'LED',
  FUTURISTIC: 'Futuristic',
  TECH: 'Tech',
  ELECTRO: 'Electro',
  GAMER: 'Gamer',
  RETRO_SIGNAGE: '80s / Signage',
  TECH_FUTURE: 'Tech / Future',
  EXPERIMENTAL: 'Experimental'
};

// Fonts that support COLRv1 or other built-in color palettes.
// These fonts often ignore standard text color css/canvas fillStyle.
export const COLOR_FONTS: FontFamily[] = [
  'Nabla',
  'Kalnia Glaze',
  'Honk'
];

export const FONTS: FontFamily[] = [
  'Abril Fatface', 'Alfa Slab One', 'Amatic SC', 'Anton', 'Audiowide', 'Bangers', 'Bebas Neue', 'Bodoni Moda', 'Bruno Ace SC', 'Bungee', 'Bungee Shade', 'Butcherman', 'Cinzel',
  'Cormorant Garamond', 'Creepster', 'Crimson Text', 'Diplomata', 'DM Serif Display', 'Dancing Script', 'DotGothic16', 'Doto', 'Eater', 'Eduardo Tunni', 'Ewert', 'Exo 2', 'Fascinate Inline', 'Finger Paint', 'Fira Code',
  'Foldit', 'Fraunces', 'Frijole', 'Geostar', 'Gloria Hallelujah', 'Gluten', 'Great Vibes', 'Grenze Gotisch', 'Handjet', 'Honk', 'Inter', 'Italiana', 'Jacquard 12', 'Jersey 10', 'Josefin Sans', 'Kablammo', 'Kalnia Glaze', 'Krona One', 'Lato', 'League Gothic', 'Libre Baskerville',
  'Lobster', 'Lora', 'Major Mono Display', 'Megrim', 'Merriweather', 'Metal Mania', 'Michroma', 'Micro 5', 'Monoton', 'Montserrat', 'Nabla', 'Nosifer', 'Noto Sans', 'Oi', 'Open Sans', 'Orbitron', 'Oswald', 'Oxanium',
  'PT Sans', 'PT Serif', 'Pacifico', 'Permanent Marker', 'Piedra', 'Pixelify Sans', 'Plaster', 'Playfair Display', 'Poiret One', 'Poppins', 'Press Start 2P', 'Quantico', 'Raleway', 'Righteous',
  'Roboto', 'Rock Salt', 
  // Rubik Collection
  'Rubik', 'Rubik 80s Fade', 'Rubik Beastly', 'Rubik Broken Fax', 'Rubik Bubbles', 'Rubik Burned', 'Rubik Dirt', 'Rubik Distressed', 'Rubik Doodle Shadow', 'Rubik Doodle Triangles', 
  'Rubik Gemstones', 'Rubik Glitch', 'Rubik Glitch Pop', 'Rubik Iso', 'Rubik Lines', 'Rubik Maps', 'Rubik Marker Hatch', 'Rubik Maze', 'Rubik Microbe', 'Rubik Mono One', 
  'Rubik Moonrocks', 'Rubik Pixels', 'Rubik Puddles', 'Rubik Scribble', 'Rubik Spray Paint', 'Rubik Storm', 'Rubik Vinyl', 'Rubik Wet Paint', 
  'Rye', 'Sancreek', 'Shadows Into Light', 'Share Tech Mono', 'Shojumaru', 'Silkscreen', 'Sixtyfour', 'Slackey', 'Smokum', 'Sora', 'Source Sans 3', 'Space Grotesk', 'Space Grotesque', 'Space Mono', 'Special Elite', 'Syne',
  'Tilt Warp', 'Turret Road', 'Unbounded', 'UnifrakturMaguntia', 'VT323', 'Vast Shadow', 'Wallpoet', 'Workbench', 'Zen Dots'
];

// Variable Font Axis Definition
export interface FontAxis {
  tag: string;       // e.g. 'wght', 'wdth', 'WONK'
  name: string;      // e.g. 'Weight', 'Width', 'Wonkiness'
  min: number;
  max: number;
  defaultValue: number;
  step: number;
  inputType?: 'slider' | 'toggle'; // New: Control the UI presentation
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
  'Doto': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1 },
      { tag: 'ROND', name: 'Roundness', min: 0, max: 100, defaultValue: 0, step: 1 }
    ]
  },
  'Fraunces': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 10 },
      { tag: 'opsz', name: 'Optical Size', min: 9, max: 144, defaultValue: 12, step: 0.1 },
      { tag: 'SOFT', name: 'Softness', min: 0, max: 100, defaultValue: 0, step: 1 },
      // Change WONK to a toggle with step 1 (0 or 1)
      { tag: 'WONK', name: 'Wonkiness', min: 0, max: 1, defaultValue: 0, step: 1, inputType: 'toggle' }
    ]
  },
  'Gluten': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1 },
      { tag: 'slnt', name: 'Slant', min: -13, max: 13, defaultValue: 0, step: 1 }
    ]
  },
  'Handjet': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1 },
      { tag: 'ELGR', name: 'Grid Size', min: 1, max: 2, defaultValue: 1, step: 0.1 },
      { tag: 'ELSH', name: 'Element Shape', min: 0, max: 16, defaultValue: 0, step: 0.1 }
    ]
  },
  'Exo 2': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1 }
    ]
  },
  'Space Grotesk': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 300, max: 700, defaultValue: 400, step: 1 }
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
  'Rubik': {
    axes: [
        { tag: 'wght', name: 'Weight', min: 300, max: 900, defaultValue: 400, step: 10 }
    ]
  },
  'Sora': {
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 800, defaultValue: 400, step: 1 }
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
  },
  'Nabla': {
    axes: [
        { tag: 'EDPT', name: 'Depth', min: 0, max: 200, defaultValue: 100, step: 1 },
        { tag: 'EHLT', name: 'Highlight', min: 0, max: 24, defaultValue: 12, step: 1 }
    ]
  },
  'Kalnia Glaze': {
    axes: [
        { tag: 'wght', name: 'Weight', min: 100, max: 700, defaultValue: 400, step: 1 },
        { tag: 'wdth', name: 'Width', min: 100, max: 125, defaultValue: 100, step: 0.1 }
    ]
  },
  'Honk': {
    axes: [
        { tag: 'MORF', name: 'Morph', min: 0, max: 45, defaultValue: 0, step: 0.1 },
        { tag: 'SHLN', name: 'Shadow Length', min: 0, max: 100, defaultValue: 0, step: 1 }
    ]
  },
  'Tilt Warp': {
    axes: [
      { tag: 'XROT', name: 'X Rotation', min: -45, max: 45, defaultValue: 0, step: 1 },
      { tag: 'YROT', name: 'Y Rotation', min: -45, max: 45, defaultValue: 0, step: 1 }
    ]
  }
};


// Helper to map fonts to categories
export const getFontCategory = (font: FontFamily): string => {
  // Check Color Fonts first
  if (COLOR_FONTS.includes(font)) {
      return FONT_CATEGORIES.COLOR;
  }

  const map: Record<string, string[]> = {
    [FONT_CATEGORIES.SANS]: [
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Oswald', 
        'Noto Sans', 'Source Sans 3', 'PT Sans', 'Josefin Sans', 'Anton', 'Bebas Neue', 
        'League Gothic', 'Space Grotesque', 'Unbounded', 'Quantico', 'Sora', 'Rubik'
    ],
    [FONT_CATEGORIES.SERIF]: [
        'Merriweather', 'Playfair Display', 'Lora', 'PT Serif', 'Crimson Text', 
        'Libre Baskerville', 'Bodoni Moda', 'Cinzel', 'Cormorant Garamond', 
        'DM Serif Display', 'Abril Fatface', 'Italiana'
    ],
    [FONT_CATEGORIES.HANDWRITING]: [
        'Dancing Script', 'Pacifico', 'Shadows Into Light', 'Amatic SC', 
        'Gloria Hallelujah', 'Permanent Marker', 'Great Vibes', 'Rock Salt', 
        'Finger Paint', 'Lobster', 'Eduardo Tunni', 'Gluten'
    ],
    [FONT_CATEGORIES.MONO]: [
        'Fira Code', 'Space Mono'
    ],
    [FONT_CATEGORIES.DOT_MATRIX]: [
        'DotGothic16', 'Silkscreen', 'VT323', 'Doto'
    ],
    [FONT_CATEGORIES.LED]: [
        'Handjet'
    ],
    [FONT_CATEGORIES.FUTURISTIC]: [
        'Orbitron', 'Michroma'
    ],
    [FONT_CATEGORIES.TECH]: [
        'Exo 2'
    ],
    [FONT_CATEGORIES.ELECTRO]: [
        'Bruno Ace SC'
    ],
    [FONT_CATEGORIES.GAMER]: [
        'Press Start 2P', 'Pixelify Sans'
    ],
    [FONT_CATEGORIES.RETRO_SIGNAGE]: [
        'Bungee'
    ],
    [FONT_CATEGORIES.TECH_FUTURE]: [
        'Space Grotesk'
    ],
    [FONT_CATEGORIES.EXPERIMENTAL]: [
        'Syne', 'Rubik Dirt', 'Rubik Distressed', 'Rubik Maps', 'Rubik Moonrocks', 'Rubik Scribble', 'Rubik Spray Paint', 'Rubik Storm'
    ],
    [FONT_CATEGORIES.ALIEN]: [
        'Audiowide', 'Turret Road', 'Zen Dots', 'Megrim', 
        'Press Start 2P', 'Wallpoet', 'Rubik Glitch', 'Rubik Beastly', 'Rubik Microbe', 'Rubik Wet Paint', 
        'Rubik Broken Fax', 'Rubik Glitch Pop', 'Rubik Lines', 'Rubik Maze', 'Rubik Pixels',
        'Frijole', 'Butcherman', 'Creepster', 'Eater', 'Metal Mania', 'Nosifer', 'Piedra', 'Sancreek',
        'Sixtyfour', 'Share Tech Mono', 'Oxanium', 
        'Krona One', 'Jacquard 12', 'Jersey 10', 'Micro 5'
    ],
    [FONT_CATEGORIES.DISPLAY]: [
        'Alfa Slab One', 'Bangers', 'Bungee Shade', 'Fascinate Inline', 'Monoton', 
        'Plaster', 'Poiret One', 'Righteous', 'Shojumaru', 'Special Elite', 
        'UnifrakturMaguntia', 'Rye', 'Foldit', 'Kablammo', 'Rubik Iso', 'Rubik 80s Fade',
        'Rubik Burned', 'Rubik Marker Hatch', 'Rubik Puddles', 'Rubik Mono One', 'Rubik Vinyl', 'Rubik Gemstones', 'Rubik Bubbles', 'Rubik Doodle Shadow', 'Rubik Doodle Triangles',
        'Diplomata', 'Geostar', 
        'Ewert', 'Grenze Gotisch', 'Vast Shadow', 'Workbench', 'Slackey', 'Smokum', 'Oi'
    ],
    [FONT_CATEGORIES.FANCY]: [
        'Fraunces', 'Tilt Warp'
    ]
  };

  for (const [category, fonts] of Object.entries(map)) {
    if (fonts.includes(font)) return category;
  }
  return FONT_CATEGORIES.DISPLAY; // Fallback
};