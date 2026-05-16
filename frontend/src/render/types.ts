/** Discriminated layer kinds (bottom → top paint order). */
export type CompositorLayerType =
  | "shadow"
  | "lens-gradient"
  | "lens-image"
  | "highlight"
  | "frame-vector"
  | "frame-image"
  | "tint-overlay";

export interface TintGradient {
  name: string;
  top: string;
  bottom: string;
}

export interface FrameColorSelection {
  name: string;
  hex: string;
}

/** Builder toggle state keyed by `sunglasses_builder_options.code`. */
export type SunglassesRenderOptions = Record<string, boolean>;

/**
 * - `customiser-dynamic`: lens tint via SVG gradient on lens path only; frame vector updates colour; **no** pre-rendered tint swaps.
 * - `catalogue`: legacy/admin path — may use raster plates when catalogue provides URLs.
 */
export type CompositorRenderMode = "customiser-dynamic" | "catalogue";

/** Input to the compositor (vector demo, raster catalogue assets, or hybrid). */
export interface SunglassesCompositorConfig {
  renderMode?: CompositorRenderMode;
  basePrice: number;
  frame: FrameColorSelection;
  tint: TintGradient;
  options: SunglassesRenderOptions;
  /** Ignored when `renderMode` is `customiser-dynamic`. */
  raster?: {
    frameImageUrl?: string;
    lensImageUrl?: string;
    /** Apply CSS/SVG gradient tint on top of raster plate */
    useGradientOverlay?: boolean;
  };
}

export type CompositorView = "front" | "side";

export interface CompositorLayerSpec {
  id: string;
  type: CompositorLayerType;
  zIndex: number;
  visible?: boolean;
  opacity?: number;
  /** Layer-specific payload */
  payload: Record<string, unknown>;
}

export interface CompositorStack {
  view: CompositorView;
  layers: CompositorLayerSpec[];
}

/** Legacy bitmap pipeline descriptor (future canvas export). */
export type RenderLayerKind = "base" | "mask" | "tint" | "bead" | "overlay" | "preview";

export interface RenderLayerDescriptor {
  id: string;
  kind: RenderLayerKind;
  src: string;
  zIndex: number;
  opacity?: number;
}

export interface RenderComposition {
  layers: RenderLayerDescriptor[];
  width: number;
  height: number;
}

export interface RenderFacade {
  init(): void;
  getAssetLoader(): import("./assets/asset-loader.js").AssetLoader;
  compose?(composition: RenderComposition): Promise<void>;
}
