import type { FrameRenderView } from "@/types/frame-rendering";

export interface LensColor {
  _id?: string;
  colorName: string;
  image: string;
}

export interface FrameEntry {
  id: string;
  _id?: string;
  name: string;
  price: number;
  description: string;
  /** When false, hidden from sunglasses customiser (still visible in admin). */
  isActive?: boolean;
  displayOrder?: number;
  /** @deprecated Use renderViews (front/side masked plates). */
  frameImages?: string[];
  /** @deprecated Lens tint is configured via sunglasses catalog, not per-frame swatches. */
  lensColors?: LensColor[];
  /** Masked photo plates per view (front + side). */
  renderViews?: FrameRenderView[];
}

const STATIC_FRAMES: FrameEntry[] = [];

export const DEFAULT_FRAMES: FrameEntry[] = STATIC_FRAMES;
