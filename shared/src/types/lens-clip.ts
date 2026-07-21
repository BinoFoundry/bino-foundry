/** Per-lens SVG clip path in image coordinate space (matches plate width/height). */
export interface LensClipShape {
  id: string;
  label: string;
  /** SVG path `d` attribute (M/L/C/Z) in pixel coords for viewBox 0 0 imageWidth imageHeight */
  pathD: string;
  /**
   * @deprecated Exclusions are now frame-level ({@link LensClipConfig.frameExclusions}).
   * Read only for migrating older per-lens saved configs.
   */
  exclusions?: LensExclusionShape[];
}

/** A single exclusion polygon path (frame hardware silhouette). */
export interface LensExclusionShape {
  id: string;
  label: string;
  pathD: string;
}

/**
 * Frame-level exclusion polygon. These are FRAME components (bridge, screws, inner rim,
 * support bars) that sit inside the lens opening and must stay visible above the rendered
 * lens. They belong to the frame, not to either lens, so `lensId` is optional/legacy only.
 */
export interface FrameExclusionShape extends LensExclusionShape {
  /** @deprecated Legacy association to a lens opening id — no longer used for rendering. */
  lensId?: string;
}

/**
 * Frame-level optical / compositing settings stored on `clip_config.render`.
 * Customer tint colours still come from `sunglasses_lens_tints`; these tune how the
 * synthetic lens is painted inside the clipping polygons.
 */
export interface LensClipRenderSettings {
  /** Admin scope for opacity controls. Defaults to `global` for legacy configs. */
  renderScope?: "global" | "front" | "side";
  /**
   * `replace` — knock out original lens pixels and paint a synthetic lens (default).
   * `overlay` is accepted only for reading legacy data; rendering always uses replacement.
   */
  mode?: "replace" | "overlay";

  /** Strength of the selected tint inside the replacement material (0–1). */
  tintOpacity?: number;
  /**
   * Final SVG opacity applied directly to every tint path (0–1). Controls perceived lens
   * thickness/density without changing the selected tint colour or gradient reference.
   */
  tintLayerOpacity?: number;
  /** @deprecated Legacy multiplier; read only when migrating settings saved by v000064. */
  tintFilterOpacity?: number;
  /**
   * Overall opacity of the generated optical material (0–1). Source hue is removed; only
   * normalized luminance/detail may be retained beneath the generated tint.
   */
  lensOpacity?: number;
  /**
   * Fraction of background light transmitted through the generated lens (0–1).
   * Surface reflections remain visible independently, as they would on real glass.
   */
  lensTransmission?: number;
  /** Opacity of restored frame-exclusion pixels (0–1), independent of lens opacity. */
  frameExclusionOpacity?: number;
  /**
   * Opacity of the solid lens base painted beneath the tint (0–1).
   * Keeps the lens reading as real glass instead of a translucent hole, and makes
   * the same tint look identical across frames (no background bleed-through).
   */
  baseTintOpacity?: number;
  /** Amount of neutralized optical/background detail transmitted through the glass (0–1). */
  transparency?: number;
  /** Optical colour adjustments; 1 is neutral. */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  /** Prefer customer tint gradient when true (default). */
  gradientEnabled?: boolean;
  /** Optional frame-level gradient colour overrides (hex). */
  gradientTopColor?: string;
  gradientBottomColor?: string;
  /** Vertical mid-stop 0–100 (darker top → lighter bottom emphasis). */
  gradientPosition?: number;
  /** Strength of the gradient layer over the translucent glass base (0–1). */
  gradientStrength?: number;

  reflectionEnabled?: boolean;
  reflectionStrength?: number;
  reflectionOpacity?: number;
  reflectionAngle?: number;
  reflectionBlur?: number;

  glossEnabled?: boolean;
  glossIntensity?: number;
  /** Preferred name for gloss intensity; `glossIntensity` remains compatible. */
  glossStrength?: number;

  vignetteEnabled?: boolean;
  vignetteStrength?: number;
  /** Preferred name for edge vignette strength; `vignetteStrength` remains compatible. */
  edgeFade?: number;
  /** Darkness of the subtle inner lens rim / optical thickness (0–1). */
  edgeDarkness?: number;
  /** Inner rim width as a fraction of the shorter source-image dimension (0–0.05). */
  edgeWidth?: number;

  /**
   * Global transparency of the synthetic lens (0–1). Higher reveals more of the scene
   * rendered behind the lens (the transparent, knocked-out opening) — never the original
   * lens texture, which is discarded entirely.
   */
  backgroundVisibility?: number;
  /**
   * Thins the coloured lens body so the background shows through the tint (0–1). Affects
   * the rendered scene behind the lens only; never reveals original lens pixels.
   */
  environmentTransparency?: number;
  /** Density reinforcement toward the lens centre (0–1). Independent of tint opacity. */
  centerDensity?: number;
  /** Outer-edge thickness darkening (0–1). Independent of tint opacity. */
  edgeDensity?: number;

  polarizedEnabled?: boolean;
  polarizedStrength?: number;

  /** @deprecated Overlay-mode only. */
  tintBlendMode?: "multiply" | "screen" | "overlay" | "color" | "soft-light";
  /** @deprecated Overlay-mode only. */
  highlightStrength?: number;
  /** @deprecated Overlay-mode only. */
  highlightBlendMode?: "screen" | "overlay" | "soft-light";
  /** @deprecated Overlay-mode only. */
  shadowStrength?: number;
}

export const LENS_CLIP_CONFIG_V1 = 1 as const;

/** Stored in `frame_render_views.clip_config` — primary tint clipping definition. */
export interface LensClipConfig {
  version: typeof LENS_CLIP_CONFIG_V1;
  imageWidth: number;
  imageHeight: number;
  lenses: LensClipShape[];
  /**
   * Frame-level exclusion polygons. Rendered as an overlay of the original frame ABOVE the
   * synthetic lens, so frame hardware inside the opening stays visible. Independent of the
   * lens clip; empty/absent means the lens fills the whole opening (legacy behaviour).
   */
  frameExclusions?: FrameExclusionShape[];
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

function isUsablePathD(pathD: string | undefined): boolean {
  return typeof pathD === "string" && pathD.trim().length > 8;
}

/** Exclusion holes stored on a single lens clip shape. */
export function resolveLensExclusionShapes(
  lens: Pick<LensClipShape, "exclusions"> | null | undefined,
): LensExclusionShape[] {
  const list = lens?.exclusions;
  if (!Array.isArray(list)) return [];
  return list.filter((s) => isUsablePathD(s?.pathD));
}

/**
 * The merged frame-level exclusion list.
 *
 * Collects canonical root `frameExclusions` plus any legacy per-lens `exclusions[]`
 * (from older saved configs) into a single flat list so callers never need to know
 * where the data was stored. IDs are de-duplicated.
 */
export function resolveFrameExclusionShapes(
  clip: Pick<LensClipConfig, "frameExclusions" | "lenses"> | null | undefined,
): FrameExclusionShape[] {
  if (!clip) return [];
  const out: FrameExclusionShape[] = [];
  const seen = new Set<string>();

  const push = (shape: LensExclusionShape | FrameExclusionShape | undefined, lensId?: string) => {
    if (!isUsablePathD(shape?.pathD)) return;
    let id = shape!.id || `frame-exclusion-${out.length}`;
    while (seen.has(id)) id = `${id}-${out.length}`;
    seen.add(id);
    out.push({ id, label: shape!.label || "Frame exclusion", pathD: shape!.pathD });
  };

  for (const shape of clip.frameExclusions ?? []) push(shape, shape.lensId);
  for (const lens of clip.lenses ?? []) {
    for (const shape of resolveLensExclusionShapes(lens)) push(shape, lens.id);
  }

  return out;
}

/**
 * Normalize to the canonical frame-level shape: gather every exclusion (root + legacy
 * per-lens) into root `frameExclusions` and strip per-lens `exclusions`. Frames without
 * any exclusions are returned unchanged (aside from dropping empty keys).
 */
export function normalizeLensClipConfig(clip: LensClipConfig): LensClipConfig {
  const frameExclusions = resolveFrameExclusionShapes(clip);
  const lenses = clip.lenses.map((lens) => {
    if (!lens.exclusions) return lens;
    const { exclusions: _drop, ...rest } = lens;
    return rest;
  });

  const { frameExclusions: _dropRoot, ...rest } = clip;
  if (!frameExclusions.length) {
    return { ...rest, lenses };
  }
  return {
    ...rest,
    lenses,
    frameExclusions,
    updatedAt: clip.updatedAt ?? Date.now(),
  };
}
