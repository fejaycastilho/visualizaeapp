
export enum ModelType {
  NANO_BANANA_1 = 'gemini-2.5-flash-image', // "Nano Banana 1"
  NANO_BANANA_2 = 'gemini-3-pro-image-preview', // "Nano Banana 2"
  KLING_PRO = 'kling-v3-pro', // "Kling 3.0 Pro"
}

export interface Resolution {
  w: number;
  h: number;
  ratio: number;
  label?: string;
}

export type ToolType = 'select' | 'eraser' | 'move' | 'hand' | 'decor';

export interface DecorZone {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  type: 'image' | 'generation' | 'video';
  src?: string;
  thumbnail?: string;
  // Positioning
  x: number;
  y: number;
  width: number;
  height: number;

  // Initial state for reset
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;

  // Style
  feather?: number; // 0 to 100 representing intensity of edge fade
  renderMode?: 'cover' | 'fill'; // Controls object-fit behavior

  // Video specific
  isPlaying?: boolean;

  // Decor zone data (for re-rendering when label/fontSize change)
  decorData?: {
    points: { x: number; y: number }[];
    label: string;
    color: string;
    fontSize: number;
  };
}

export interface User {
  id: string;
  username: string;
}

// Minimal shape for the Gemini API response handling within the app
export interface GenerationResult {
  imageUrl: string;
  prompt: string;
}

// --- Studio Mode Types ---

export interface Shot {
  prompt: string;
  duration: string;
}

export interface Scene {
  id: string;
  startFrame: string | null;
  endFrame: string | null;
  shots: Shot[];
  videos: string[];
  selectedVideoIndex: number;
  isGenerating: boolean;
  variationCount: number;
}

// Serializable version of Scene (no blob URLs, uses storage paths)
export interface StudioSceneData {
  id: string;
  shots: Shot[];
  selectedVideoIndex: number;
  variationCount: number;
  startFrameStoragePath?: string;
  endFrameStoragePath?: string;
  videoStoragePaths: string[];
}

// --- Project History System ---

export interface ProjectHistoryEntry {
  id: string;
  name: string;
  thumbnail: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
  layerCount: number;
  canvasSize: { w: number; h: number };
  studioScenes?: StudioSceneData[];
  studioOrientation?: 'auto' | 'horizontal' | 'vertical';
}

export interface ProjectLayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  type: 'image' | 'generation' | 'video';
  storagePath?: string;     // Firebase Storage path for the image
  thumbnail?: string;       // Small base64 for layer thumbnail
  x: number;
  y: number;
  width: number;
  height: number;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  feather?: number;
  renderMode?: 'cover' | 'fill';
  isPlaying?: boolean;
}
