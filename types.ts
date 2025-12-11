export interface Adjustments {
  exposure: number; // -100 to 100
  contrast: number; // -100 to 100
  temperature: number; // -100 to 100 (Blue to Yellow)
  tint: number; // -100 to 100 (Green to Magenta)
  vibrance: number; // -100 to 100
  saturation: number; // -100 to 100
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Photo {
  id: string;
  name: string;
  originalUrl: string; // The blob URL
  thumbnailUrl: string; // Smaller version for UI
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  adjustments: Adjustments;
  crop: CropData | null;
  frameOverlay: string | null; // URL of the PNG frame
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
};

export type AspectRatio = 'Free' | '1:1' | '4:3' | '16:9' | '3:2';