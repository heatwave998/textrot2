import { DesignState, AppSettings, TextLayer } from '../types';

export const INITIAL_LAYER_ID = 'layer-1';

// Helper to create a new layer
export const createLayer = (id: string, text: string = 'EDIT ME'): TextLayer => ({
  id,
  name: 'Text Layer',
  visible: true,
  locked: false,
  textOverlay: text,
  fontFamily: 'Inter',
  textColor: '#FFFFFF',
  shadowColor: '#000000',
  textSize: 5,
  letterSpacing: 0,
  letterRotation: 0,
  textAlign: 'center',
  overlayPosition: { x: 50, y: 50 },
  blendMode: 'normal',
  opacity: 1,
  
  // Font Variations (Variable Fonts)
  fontVariations: {},

  pathPoints: [],
  pathSmoothing: 5,
  isPathInputMode: false,
  isPathMoveMode: false,

  shadowBlur: 20,
  hasShadow: true,
  shadowOffset: 20,
  shadowAngle: 45,
  shadowOpacity: 1.0,
  shadowGrow: 0,
  
  isBold: false,
  isItalic: false,
  isUppercase: false,
  
  isHollow: false,
  hasOutline: false,
  outlineWidth: 2,
  outlineColor: '#000000',
  
  specialEffect: 'none',
  effectIntensity: 50,
  effectColor: '#FF0000',
  effectColor2: '#00FFFF',
  isRainbowGlitch: false,
  isRainbowLights: false, // Default to normal blending
  rainbowOpacity: 1.0,
  rainbowBlur: 0,
  effectAngle: 90,
  
  rotation: 360,
  flipX: false,
  flipY: false
});

// Initial State
export const DEFAULT_DESIGN: DesignState = {
  prompt: '',
  aspectRatio: '1:1',
  orientation: 'landscape',
  layers: [createLayer(INITIAL_LAYER_ID)],
  activeLayerId: INITIAL_LAYER_ID,
  selectedLayerIds: [INITIAL_LAYER_ID],
  backgroundType: 'image', // Default to image mode until Blank is clicked
  backgroundColor: '#ffffff'
};

export const DEFAULT_SETTINGS: AppSettings = {
  enableZoom: true,
  googleApiKey: '',
  imageModel: 'gemini-3-pro-image-preview',
  imageResolution: '1K',
  quality: 'Photorealistic, 8k, highly detailed',
  generationSystemPrompt: 'Cinematic lighting, negative space for text overlay, polished design aesthetic.',
  editingSystemPrompt: 'Maintain photorealism.',
  showFontDebug: false
};
