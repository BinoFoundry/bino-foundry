import type { LensClipConfig, LensClipRenderSettings } from "@bino-foundry/shared/types";

/** Resolved optical settings for the replace-lens compositor. */
export type ResolvedLensClipRender = Required<
  Pick<
    LensClipRenderSettings,
    | "mode"
    | "tintOpacity"
    | "gradientEnabled"
    | "gradientPosition"
    | "reflectionEnabled"
    | "reflectionOpacity"
    | "reflectionBlur"
    | "glossEnabled"
    | "glossIntensity"
    | "vignetteEnabled"
    | "vignetteStrength"
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
  tintOpacity: 1,
  gradientEnabled: true,
  gradientTopColor: null,
  gradientBottomColor: null,
  gradientPosition: 45,
  reflectionEnabled: true,
  reflectionOpacity: 0.22,
  reflectionBlur: 0.35,
  glossEnabled: true,
  glossIntensity: 0.28,
  vignetteEnabled: true,
  vignetteStrength: 0.2,
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
      overrides?.lensOpacity ??
      fromConfig?.tintOpacity ??
      fromConfig?.lensOpacity,
    DEFAULT_LENS_CLIP_RENDER.tintOpacity,
  );

  return {
    mode: merged.mode === "overlay" ? "overlay" : "replace",
    tintOpacity,
    gradientEnabled: merged.gradientEnabled !== false,
    gradientTopColor: merged.gradientTopColor?.trim() || null,
    gradientBottomColor: merged.gradientBottomColor?.trim() || null,
    gradientPosition: clampPct(merged.gradientPosition, DEFAULT_LENS_CLIP_RENDER.gradientPosition),
    reflectionEnabled: merged.reflectionEnabled !== false,
    reflectionOpacity: clamp01(merged.reflectionOpacity, DEFAULT_LENS_CLIP_RENDER.reflectionOpacity),
    reflectionBlur: clamp01(merged.reflectionBlur, DEFAULT_LENS_CLIP_RENDER.reflectionBlur),
    glossEnabled: merged.glossEnabled !== false,
    glossIntensity: clamp01(merged.glossIntensity, DEFAULT_LENS_CLIP_RENDER.glossIntensity),
    vignetteEnabled: merged.vignetteEnabled !== false,
    vignetteStrength: clamp01(merged.vignetteStrength, DEFAULT_LENS_CLIP_RENDER.vignetteStrength),
    polarizedEnabled: Boolean(merged.polarizedEnabled),
    polarizedStrength: clamp01(merged.polarizedStrength, DEFAULT_LENS_CLIP_RENDER.polarizedStrength),
    tintBlendMode: merged.tintBlendMode ?? DEFAULT_LENS_CLIP_RENDER.tintBlendMode,
    highlightStrength: clamp01(merged.highlightStrength, DEFAULT_LENS_CLIP_RENDER.highlightStrength),
    highlightBlendMode: merged.highlightBlendMode ?? DEFAULT_LENS_CLIP_RENDER.highlightBlendMode,
    shadowStrength: clamp01(merged.shadowStrength, DEFAULT_LENS_CLIP_RENDER.shadowStrength),
  };
}
