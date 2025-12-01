
export enum DesignMode {
  CREATE = 'CREATE',
  EDIT = 'EDIT',
}

export type FontFamily = 
  | 'Abril Fatface' 
  | 'Alfa Slab One'
  | 'Amatic SC'
  | 'Anton'
  | 'Bangers'
  | 'Bebas Neue'
  | 'Bodoni Moda'
  | 'Cinzel' 
  | 'Cormorant Garamond'
  | 'Crimson Text'
  | 'DM Serif Display'
  | 'Dancing Script'
  | 'Eduardo Tunni'
  | 'Fira Code'
  | 'Gloria Hallelujah'
  | 'Great Vibes'
  | 'Inter' 
  | 'Italiana'
  | 'Josefin Sans'
  | 'Lato'
  | 'League Gothic'
  | 'Libre Baskerville'
  | 'Lobster'
  | 'Lora'
  | 'Merriweather'
  | 'Monoton'
  | 'Montserrat' 
  | 'Noto Sans'
  | 'Open Sans'
  | 'Orbitron'
  | 'Oswald'
  | 'PT Sans'
  | 'PT Serif'
  | 'Pacifico'
  | 'Permanent Marker'
  | 'Playfair Display' 
  | 'Poppins'
  | 'Raleway'
  | 'Righteous'
  | 'Roboto'
  | 'Rubik Glitch'
  | 'Shadows Into Light'
  | 'Source Sans 3'
  | 'Space Grotesque'
  | 'Space Mono' 
  | 'Syne'
  | 'Unbounded'
  | 'VT323';

export type AspectRatio = '1:1' | '4:3' | '3:2' | '16:9';
export type Orientation = 'landscape' | 'portrait';
export type SpecialEffect = 'none' | 'glitch' | 'gradient' | 'echo';

export interface Point {
  x: number;
  y: number;
}

export interface TextLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;

  textOverlay: string;
  fontFamily: FontFamily;
  textColor: string;
  shadowColor: string;
  textSize: number;
  letterSpacing: number; // Kerning in em units (or pixels relative to font size)
  letterRotation: number; // Rotation of individual letters in degrees
  textAlign: 'left' | 'center' | 'right';
  overlayPosition: { x: number; y: number }; // Percentages 0-100
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
  opacity: number;
  
  // Path / Curve Data
  pathPoints: Point[]; // Array of coordinates relative to the image dimensions
  pathSmoothing: number; // 0-20 iterations of smoothing
  isPathInputMode: boolean; // If true, user is drawing on canvas instead of panning
  isPathMoveMode: boolean; // If true, user is moving the existing path

  // Shadow Controls
  shadowBlur: number;
  hasShadow: boolean;
  shadowOffset: number; // 0-100
  shadowAngle: number; // 0-360

  // Typography Modifiers
  isBold: boolean;
  isItalic: boolean;
  isUppercase: boolean;
  
  // Effects
  isHollow: boolean;
  hasOutline: boolean;
  outlineWidth: number;
  outlineColor: string;

  // Special FX
  specialEffect: SpecialEffect;
  effectIntensity: number; // 0-100. Glitch=Offset, Echo=Distance, Gradient=Spread
  effectColor: string; // Primary Effect Color (Glitch Left / Gradient End)
  effectColor2: string; // Secondary Effect Color (Glitch Right)
  isRainbowGlitch: boolean; // Toggle for Rainbow Glitch
  rainbowOpacity: number; // 0-1 for rainbow layer opacity
  rainbowBlur: number; // Blur amount for rainbow layers
  effectAngle: number; // 0-360 for Gradient Angle and Echo Direction
  
  // Transforms
  rotation: number; // 0-360
  flipX: boolean;
  flipY: boolean;
}

export interface DesignState {
  prompt: string;
  aspectRatio: AspectRatio;
  orientation: Orientation;
  
  layers: TextLayer[];
  activeLayerId: string | null;
}

export interface AppSettings {
  enableZoom: boolean;
}
