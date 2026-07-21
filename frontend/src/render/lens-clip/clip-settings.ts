import type { LensClipConfig, LensClipRenderSettings } from "@bino-foundry/shared/types";

/** Resolved optical settings for the replace-lens compositor. */
export type ResolvedLensClipRender = Required<
  Pick<
    LensClipRenderSettings,
    | "mode"
    | "tintOpacity"
    | "tintLayerOpacity"
    | "lensOpacity"
    | "lensTransmission"
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
    | "edgeDarkness"
    | "edgeWidth"
    | "backgroundVisibility"
    | "environmentTransparency"
    | "centerDensity"
    | "edgeDensity"
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
  tintOpacity: 0.78,
  // Preserve the pre-configuration renderer output exactly (displayed as 0.43 in Admin).
  tintLayerOpacity: 0.42978,
  lensOpacity: 0.9,
  lensTransmission: 0.42,
  frameExclusionOpacity: 1,
  baseTintOpacity: 0.9,
  transparency: 0.42,
  brightness: 1.02,
  contrast: 1.04,
  saturation: 0.98,
  gradientEnabled: true,
  gradientTopColor: null,
  gradientBottomColor: null,
  gradientPosition: 45,
  gradientStrength: 0.24,
  reflectionEnabled: true,
  reflectionStrength: 0.42,
  reflectionOpacity: 0.2,
  reflectionAngle: 22,
  reflectionBlur: 0.58,
  glossEnabled: true,
  glossIntensity: 0.3,
  glossStrength: 0.14,
  vignetteEnabled: true,
  vignetteStrength: 0.28,
  edgeFade: 0.12,
  edgeDarkness: 0.24,
  edgeWidth: 0.006,
  backgroundVisibility: 0,
  environmentTransparency: 0,
  centerDensity: 0,
  edgeDensity: 0.18,
  polarizedEnabled: false,
  polarizedStrength: 0.12,
  tintBlendMode: "multiply",
  highlightStrength: 0.12,
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
    overrides?.tintOpacity ?? fromConfig?.tintOpacity,
    DEFAULT_LENS_CLIP_RENDER.tintOpacity,
  );
  const tintLayerOpacity = clamp01(
    overrides?.tintLayerOpacity ??
      fromConfig?.tintLayerOpacity ??
      (fromConfig?.tintFilterOpacity == null
        ? undefined
        : DEFAULT_LENS_CLIP_RENDER.tintLayerOpacity * fromConfig.tintFilterOpacity),
    DEFAULT_LENS_CLIP_RENDER.tintLayerOpacity,
  );
  const configuredLensOpacity = overrides?.lensOpacity ?? fromConfig?.lensOpacity;
  const configuredLensTransmission =
    overrides?.lensTransmission ?? fromConfig?.lensTransmission;
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
  const lensTransmission = clamp01(
    configuredLensTransmission ?? configuredTransparency,
    DEFAULT_LENS_CLIP_RENDER.lensTransmission,
  );
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
    tintLayerOpacity,
    lensOpacity,
    lensTransmission,
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
    edgeDarkness: clamp01(merged.edgeDarkness, DEFAULT_LENS_CLIP_RENDER.edgeDarkness),
    edgeWidth: clampRange(merged.edgeWidth, DEFAULT_LENS_CLIP_RENDER.edgeWidth, 0, 0.05),
    backgroundVisibility: clamp01(
      merged.backgroundVisibility,
      DEFAULT_LENS_CLIP_RENDER.backgroundVisibility,
    ),
    environmentTransparency: clamp01(
      merged.environmentTransparency,
      DEFAULT_LENS_CLIP_RENDER.environmentTransparency,
    ),
    centerDensity: clamp01(merged.centerDensity, DEFAULT_LENS_CLIP_RENDER.centerDensity),
    edgeDensity: clamp01(merged.edgeDensity, DEFAULT_LENS_CLIP_RENDER.edgeDensity),
    polarizedEnabled: Boolean(merged.polarizedEnabled),
    polarizedStrength: clamp01(merged.polarizedStrength, DEFAULT_LENS_CLIP_RENDER.polarizedStrength),
    tintBlendMode: merged.tintBlendMode ?? DEFAULT_LENS_CLIP_RENDER.tintBlendMode,
    highlightStrength: clamp01(merged.highlightStrength, DEFAULT_LENS_CLIP_RENDER.highlightStrength),
    highlightBlendMode: merged.highlightBlendMode ?? DEFAULT_LENS_CLIP_RENDER.highlightBlendMode,
    shadowStrength: clamp01(merged.shadowStrength, DEFAULT_LENS_CLIP_RENDER.shadowStrength),
  };
}
