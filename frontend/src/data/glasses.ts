export interface LensColor {
  _id?: string;
  colorName: string;
  image: string;
}

// shadeMap data is now fetched directly from the database or API.
export interface FrameEntry {
  id: string;        // Client side identifier
  _id?: string; // Same as `id` when echoed by older payloads (optional)
  name: string;
  price: number;
  description: string;
  frameImages: string[];
  lensColors: LensColor[];
}

const STATIC_FRAMES: FrameEntry[] = [];

export const DEFAULT_FRAMES: FrameEntry[] = STATIC_FRAMES;
