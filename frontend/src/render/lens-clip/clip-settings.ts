import type { LensClipConfig, LensClipRenderSettings } from "@bino-foundry/shared/types";

/** Resolved optical settings for the replace-lens compositor. */
export type ResolvedLensClipRender = Required<
  Pick<
    LensClipRenderSettings,
    | "mode"
    | "tintOpacity"
    | "lensOpacity"
    | "frameExclusionOpacity"
    | "baseTintOpacity"
    | "transparency"
    | "brightness"
    | "contrast"
    | "saturation"
    | "gradientEnabled"
    | "gradientPosition"
    | "gradientStrength"
    | "reflectionEnabled"
    | "reflectionStrength"
    | "reflectionOpacity"
    | "reflectionAngle"
    | "reflectionBlur"
    | "glossEnabled"
    | "glossIntensity"
    | "glossStrength"
    | "vignetteEnabled"
    | "vignetteStrength"
    | "edgeFade"
    | "polarizedEnabled"
    | "polarizedStrength"
  >
> & {
  gradientTopColor: string | null;
  gradientBottomColor: string | null;
  /** Legacy overlay fields (used only when mode === "overlay"). */
  tintBlendMode: NonNullable<LensClipRenderSettings["tintBlendMode"]>;
  highlightStrength: number;
  highlightBlendMode: NonNullable<LensClipRenderSettings["highlightBlendMode"]>;
  shadowStrength: number;
};

export const DEFAULT_LENS_CLIP_RENDER: ResolvedLensClipRender = {
  mode: "replace",
  tintOpacity: 0.82,
  lensOpacity: 0.65,
  frameExclusionOpacity: 1,
  baseTintOpacity: 0.58,
  transparency: 0.35,
  brightness: 1.04,
  contrast: 1.08,
  saturation: 1.05,
  gradientEnabled: true,
  gradientTopColor: null,
  gradientBottomColor: null,
  gradientPosition: 45,
  gradientStrength: 0.72,
  reflectionEnabled: true,
  reflectionStrength: 0.75,
  reflectionOpacity: 0.26,
  reflectionAngle: 18,
  reflectionBlur: 0.4,
  glossEnabled: true,
  glossIntensity: 0.3,
  glossStrength: 0.3,
  vignetteEnabled: true,
  vignetteStrength: 0.28,
  edgeFade: 0.28,
  polarizedEnabled: false,
  polarizedStrength: 0.12,
  tintBlendMode: "multiply",
  highlightStrength: 0.38,
  highlightBlendMode: "screen",
  shadowStrength: 0.06,
};

function clamp01(n: number | undefined, fallback: number): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function clampPct(n: number | undefined, fallback: number): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function clampRange(n: number | undefined, fallback: number, min: number, max: number): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeAngle(n: number | undefined, fallback: number): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return ((n % 360) + 360) % 360;
}

export function resolveLensClipRenderSettings(
  clipConfig: LensClipConfig | null | undefined,
  overrides?: LensClipRenderSettings & { lensOpacity?: number },
): ResolvedLensClipRender {
  const fromConfig = clipConfig?.render;
  const merged: LensClipRenderSettings = {
    ...DEFAULT_LENS_CLIP_RENDER,
    ...fromConfig,
    ...overrides,
  };

  const tintOpacity = clamp01(
    overrides?.tintOpacity ??
      fromConfig?.tintOpacity ??
    DEFAULT_LENS_CLIP_RENDER.tintOpacity,
  );
  const configuredLensOpacity = overrides?.lensOpacity ?? fromConfig?.lensOpacity;
  const configuredTransparency = overrides?.transparency ?? fromConfig?.transparency;
  const configuredLegacyBaseOpacity =
    overrides?.baseTintOpacity ?? fromConfig?.baseTintOpacity;
  const lensOpacity =
    configuredLensOpacity == null
      ? configuredTransparency == null
        ? clamp01(configuredLegacyBaseOpacity, DEFAULT_LENS_CLIP_RENDER.lensOpacity)
        : 1 - clamp01(configuredTransparency, DEFAULT_LENS_CLIP_RENDER.transparency)
      : clamp01(configuredLensOpacity, DEFAULT_LENS_CLIP_RENDER.lensOpacity);
  const transparency = 1 - lensOpacity;
  const glossStrength = clamp01(
    overrides?.glossStrength ??
      overrides?.glossIntensity ??
      fromConfig?.glossStrength ??
      fromConfig?.glossIntensity,
    DEFAULT_LENS_CLIP_RENDER.glossStrength,
  );
  const edgeFade = clamp01(
    overrides?.edgeFade ??
      overrides?.vignetteStrength ??
      fromConfig?.edgeFade ??
      fromConfig?.vignetteStrength,
    DEFAULT_LENS_CLIP_RENDER.edgeFade,
  );

  return {
    // Legacy overlay configs are intentionally upgraded to physical replacement at runtime.
    mode: "replace",
    tintOpacity,
    lensOpacity,
    frameExclusionOpacity: clamp01(
      merged.frameExclusionOpacity,
      DEFAULT_LENS_CLIP_RENDER.frameExclusionOpacity,
    ),
    // Legacy aliases resolve to the one canonical replacement-material opacity.
    baseTintOpacity: lensOpacity,
    transparency,
    brightness: clampRange(merged.brightness, DEFAULT_LENS_CLIP_RENDER.brightness, 0.25, 2),
    contrast: clampRange(merged.contrast, DEFAULT_LENS_CLIP_RENDER.contrast, 0, 2),
    saturation: clampRange(merged.saturation, DEFAULT_LENS_CLIP_RENDER.saturation, 0, 2),
    gradientEnabled: merged.gradientEnabled !== false,
    gradientTopColor: merged.gradientTopColor?.trim() || null,
    gradientBottomColor: merged.gradientBottomColor?.trim() || null,
    gradientPosition: clampPct(merged.gradientPosition, DEFAULT_LENS_CLIP_RENDER.gradientPosition),
    gradientStrength: clamp01(merged.gradientStrength, DEFAULT_LENS_CLIP_RENDER.gradientStrength),
    reflectionEnabled: merged.reflectionEnabled !== false,
    reflectionStrength: clamp01(merged.reflectionStrength, DEFAULT_LENS_CLIP_RENDER.reflectionStrength),
    reflectionOpacity: clamp01(merged.reflectionOpacity, DEFAULT_LENS_CLIP_RENDER.reflectionOpacity),
    reflectionAngle: normalizeAngle(merged.reflectionAngle, DEFAULT_LENS_CLIP_RENDER.reflectionAngle),
    reflectionBlur: clamp01(merged.reflectionBlur, DEFAULT_LENS_CLIP_RENDER.reflectionBlur),
    glossEnabled: merged.glossEnabled !== false,
    glossIntensity: glossStrength,
    glossStrength,
    vignetteEnabled: merged.vignetteEnabled !== false,
    vignetteStrength: edgeFade,
    edgeFade,
    polarizedEnabled: Boolean(merged.polarizedEnabled),
    polarizedStrength: clamp01(merged.polarizedStrength, DEFAULT_LENS_CLIP_RENDER.polarizedStrength),
    tintBlendMode: merged.tintBlendMode ?? DEFAULT_LENS_CLIP_RENDER.tintBlendMode,
    highlightStrength: clamp01(merged.highlightStrength, DEFAULT_LENS_CLIP_RENDER.highlightStrength),
    highlightBlendMode: merged.highlightBlendMode ?? DEFAULT_LENS_CLIP_RENDER.highlightBlendMode,
    shadowStrength: clamp01(merged.shadowStrength, DEFAULT_LENS_CLIP_RENDER.shadowStrength),
  };
}
