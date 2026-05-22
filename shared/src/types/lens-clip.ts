/** Per-lens SVG clip path in image coordinate space (matches plate width/height). */
export interface LensClipShape {
  id: string;
  label: string;
  /** SVG path `d` attribute (M/L/C/Z) in pixel coords for viewBox 0 0 imageWidth imageHeight */
  pathD: string;
}

export interface LensClipRenderSettings {
  lensOpacity?: number;
  tintBlendMode?: "multiply" | "screen" | "overlay" | "color";
  highlightStrength?: number;
  highlightBlendMode?: "screen" | "overlay" | "soft-light";
  shadowStrength?: number;
}

export const LENS_CLIP_CONFIG_V1 = 1 as const;

/** Stored in `frame_render_views.clip_config` — primary tint clipping definition. */
export interface LensClipConfig {
  version: typeof LENS_CLIP_CONFIG_V1;
  imageWidth: number;
  imageHeight: number;
  lenses: LensClipShape[];
  render?: LensClipRenderSettings;
  updatedAt?: number;
}

export function isLensClipConfigValid(config: unknown): config is LensClipConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as LensClipConfig;
  if (c.version !== LENS_CLIP_CONFIG_V1) return false;
  if (!c.imageWidth || !c.imageHeight) return false;
  if (!Array.isArray(c.lenses) || c.lenses.length === 0) return false;
  return c.lenses.some((l) => typeof l.pathD === "string" && l.pathD.trim().length > 8);
}

export function createLensClipConfig(
  imageWidth: number,
  imageHeight: number,
  lenses: LensClipShape[],
  render?: LensClipRenderSettings,
): LensClipConfig {
  return {
    version: LENS_CLIP_CONFIG_V1,
    imageWidth,
    imageHeight,
    lenses,
    render,
    updatedAt: Date.now(),
  };
}
