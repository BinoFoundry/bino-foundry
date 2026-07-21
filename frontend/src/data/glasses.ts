import type { FrameRenderView } from "@/types/frame-rendering";
import type { CatalogItemMetadata } from "@/features/catalog-lifecycle/types";

export interface LensColor {
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
  availabilityStatusCode?: string;
  displayOrder?: number;
  /** Assigned lens rendering preset (DB). Null → default preset → code defaults. */
  lensRenderPresetId?: string | null;
  /** When true (default), inherit preset values; when false, sparse clip_config.render overrides apply. */
  useLensRenderPreset?: boolean;
  metadata?: CatalogItemMetadata & Record<string, unknown>;
  /** @deprecated Use renderViews (front/side masked plates). */
  frameImages?: string[];
  /** @deprecated Lens tint is configured via sunglasses catalog, not per-frame swatches. */
  lensColors?: LensColor[];
  /** Masked photo plates per view (front + side). */
  renderViews?: FrameRenderView[];
}

const STATIC_FRAMES: FrameEntry[] = [];

export const DEFAULT_FRAMES: FrameEntry[] = STATIC_FRAMES;
