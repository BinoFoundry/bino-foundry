/** Per-lens SVG clip path in image coordinate space (matches plate width/height). */
export interface LensClipShape {
  id: string;
  label: string;
  /** SVG path `d` attribute (M/L/C/Z) in pixel coords for viewBox 0 0 imageWidth imageHeight */
  pathD: string;
  /** Holes inside this lens opening — excluded from tint and all optical effects. */
  exclusions?: LensExclusionShape[];
}

/** Polygon carved out of a lens opening so frame hardware stays untinted. */
export interface LensExclusionShape {
  id: string;
  label: string;
  pathD: string;
}

/**
 * @deprecated Legacy frame-level exclusions — migrated to {@link LensClipShape.exclusions}.
 * Kept for reading older saved configs.
 */
export interface FrameExclusionShape extends LensExclusionShape {
  /** Optional association to a lens opening id (`left` / `right`). */
  lensId?: string;
}

/**
 * Frame-level optical / compositing settings stored on `clip_config.render`.
 * Customer tint colours still come from `sunglasses_lens_tints`; these tune how the
 * synthetic lens is painted inside the clipping polygons.
 */
export interface LensClipRenderSettings {
  /**
   * `replace` — knock out original lens pixels and paint a synthetic lens (default).
   * `overlay` — legacy multiply/soft-light tint on top of the plate.
   */
  mode?: "replace" | "overlay";

  /** Overall lens fill opacity (0–1). When unset, customer tint opacity is used. */
  tintOpacity?: number;
  /** Prefer customer tint gradient when true (default). */
  gradientEnabled?: boolean;
  /** Optional frame-level gradient colour overrides (hex). */
  gradientTopColor?: string;
  gradientBottomColor?: string;
  /** Vertical mid-stop 0–100 (darker top → lighter bottom emphasis). */
  gradientPosition?: number;

  reflectionEnabled?: boolean;
  reflectionOpacity?: number;
  reflectionBlur?: number;

  glossEnabled?: boolean;
  glossIntensity?: number;

  vignetteEnabled?: boolean;
  vignetteStrength?: number;

  polarizedEnabled?: boolean;
  polarizedStrength?: number;

  /** @deprecated Prefer `tintOpacity` — kept for older saved configs. */
  lensOpacity?: number;
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
   * @deprecated Prefer per-lens {@link LensClipShape.exclusions}.
   * Read for migration only.
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

/** @deprecated Prefer {@link resolveLensExclusionShapes} on each lens. */
export function resolveFrameExclusionShapes(
  clip: Pick<LensClipConfig, "frameExclusions"> | null | undefined,
): FrameExclusionShape[] {
  const list = clip?.frameExclusions;
  if (!Array.isArray(list)) return [];
  return list.filter((s) => isUsablePathD(s?.pathD));
}

/**
 * Migrate legacy root `frameExclusions` onto per-lens `exclusions` arrays.
 * Strips deprecated keys from the returned config.
 */
export function normalizeLensClipConfig(clip: LensClipConfig): LensClipConfig {
  const legacy = resolveFrameExclusionShapes(clip);
  if (!legacy.length) {
    return {
      ...clip,
      lenses: clip.lenses.map((lens) => {
        const exclusions = resolveLensExclusionShapes(lens);
        return exclusions.length ? { ...lens, exclusions } : lens;
      }),
    };
  }

  const lenses = clip.lenses.map((lens) => ({
    ...lens,
    exclusions: [...resolveLensExclusionShapes(lens)],
  }));

  for (const ex of legacy) {
    const shape: LensExclusionShape = { id: ex.id, label: ex.label, pathD: ex.pathD };
    if (ex.lensId) {
      const lens = lenses.find((l) => l.id === ex.lensId);
      if (lens) {
        lens.exclusions = [...(lens.exclusions ?? []), shape];
      }
    } else {
      for (const lens of lenses) {
        lens.exclusions = [...(lens.exclusions ?? []), { ...shape, id: `${ex.id}-${lens.id}` }];
      }
    }
  }

  const { frameExclusions: _drop, ...rest } = clip;
  return {
    ...rest,
    lenses,
    updatedAt: clip.updatedAt ?? Date.now(),
  };
}
