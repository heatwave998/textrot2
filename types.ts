export type AspectRatio = '1:1' | '4:3' | '3:2' | '16:9';

export type Orientation = 'landscape' | 'portrait';

export type GenModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

export type ImageResolution = '1K' | '2K' | '4K';

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
  letterSpacing: number;
  letterRotation: number;
  textAlign: 'left' | 'center' | 'right';
  overlayPosition: { x: number; y: number };
  blendMode: string;
  opacity: number;
  fontVariations: Record<string, number>;
  pathPoints: Point[];
  pathSmoothing: number;
  isPathInputMode: boolean;
  isPathMoveMode: boolean;
  shadowBlur: number;
  hasShadow: boolean;
  shadowOffset: number;
  shadowAngle: number;
  shadowOpacity: number;
  shadowGrow: number;
  isBold: boolean;
  isItalic: boolean;
  isUppercase: boolean;
  isHollow: boolean;
  hasOutline: boolean;
  outlineWidth: number;
  outlineColor: string;
  specialEffect: 'none' | 'glitch' | 'gradient' | 'echo';
  effectIntensity: number;
  effectColor: string;
  effectColor2: string;
  isRainbowGlitch: boolean;
  isRainbowLights: boolean;
  rainbowOpacity: number;
  rainbowBlur: number;
  effectAngle: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export interface DesignState {
  prompt: string;
  aspectRatio: AspectRatio;
  orientation: Orientation;
  layers: TextLayer[];
  activeLayerId: string | null;
  selectedLayerIds: string[];
}

export interface AppSettings {
  enableZoom: boolean;
  googleApiKey: string;
  imageModel: GenModel;
  imageResolution: ImageResolution;
  quality: string;
  generationSystemPrompt: string;
  editingSystemPrompt: string;
  showFontDebug: boolean;
}

export type FontFamily = 
  | 'Abril Fatface' 
  | 'Alfa Slab One'
  | 'Amatic SC'
  | 'Anton'
  | 'Audiowide'
  | 'Bangers'
  | 'Bebas Neue'
  | 'Bodoni Moda'
  | 'Bruno Ace SC'
  | 'Bungee'
  | 'Bungee Shade'
  | 'Butcherman'
  | 'Cinzel' 
  | 'Cormorant Garamond'
  | 'Creepster'
  | 'Crimson Text'
  | 'Diplomata'
  | 'DM Serif Display'
  | 'Dancing Script'
  | 'DotGothic16'
  | 'Doto'
  | 'Eater'
  | 'Eduardo Tunni'
  | 'Ewert'
  | 'Exo 2'
  | 'Fascinate Inline'
  | 'Finger Paint'
  | 'Fira Code'
  | 'Foldit'
  | 'Fraunces'
  | 'Frijole'
  | 'Geostar'
  | 'Gloria Hallelujah'
  | 'Gluten'
  | 'Great Vibes'
  | 'Grenze Gotisch'
  | 'Handjet'
  | 'Honk'
  | 'Inter' 
  | 'Italiana'
  | 'Jacquard 12'
  | 'Jersey 10'
  | 'Josefin Sans'
  | 'Kablammo'
  | 'Kalnia Glaze'
  | 'Krona One'
  | 'Lato'
  | 'League Gothic'
  | 'Libre Baskerville'
  | 'Lobster'
  | 'Lora'
  | 'Major Mono Display'
  | 'Megrim'
  | 'Merriweather'
  | 'Metal Mania'
  | 'Michroma'
  | 'Micro 5'
  | 'Monoton'
  | 'Montserrat' 
  | 'Nabla'
  | 'Nosifer'
  | 'Noto Sans'
  | 'Oi'
  | 'Open Sans'
  | 'Orbitron'
  | 'Oswald'
  | 'Oxanium'
  | 'PT Sans'
  | 'PT Serif'
  | 'Pacifico'
  | 'Permanent Marker'
  | 'Piedra'
  | 'Pixelify Sans'
  | 'Plaster'
  | 'Playfair Display' 
  | 'Poiret One'
  | 'Poppins'
  | 'Press Start 2P'
  | 'Quantico'
  | 'Raleway'
  | 'Righteous'
  | 'Roboto'
  | 'Rock Salt'
  | 'Rubik'
  | 'Rubik 80s Fade'
  | 'Rubik Beastly'
  | 'Rubik Broken Fax'
  | 'Rubik Bubbles'
  | 'Rubik Burned'
  | 'Rubik Dirt'
  | 'Rubik Distressed'
  | 'Rubik Doodle Shadow'
  | 'Rubik Doodle Triangles'
  | 'Rubik Gemstones'
  | 'Rubik Glitch'
  | 'Rubik Glitch Pop'
  | 'Rubik Iso'
  | 'Rubik Lines'
  | 'Rubik Maps'
  | 'Rubik Marker Hatch'
  | 'Rubik Maze'
  | 'Rubik Microbe'
  | 'Rubik Mono One'
  | 'Rubik Moonrocks'
  | 'Rubik Pixels'
  | 'Rubik Puddles'
  | 'Rubik Scribble'
  | 'Rubik Spray Paint'
  | 'Rubik Storm'
  | 'Rubik Vinyl'
  | 'Rubik Wet Paint'
  | 'Rye'
  | 'Sancreek'
  | 'Shadows Into Light'
  | 'Share Tech Mono'
  | 'Shojumaru'
  | 'Silkscreen'
  | 'Sixtyfour'
  | 'Slackey'
  | 'Smokum'
  | 'Sora'
  | 'Source Sans 3'
  | 'Space Grotesk'
  | 'Space Grotesque'
  | 'Space Mono' 
  | 'Special Elite'
  | 'Syne'
  | 'Tilt Warp'
  | 'Turret Road'
  | 'Unbounded'
  | 'UnifrakturMaguntia'
  | 'VT323'
  | 'Vast Shadow'
  | 'Wallpoet'
  | 'Workbench'
  | 'Zen Dots';