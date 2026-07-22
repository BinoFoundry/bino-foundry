import type { LensClipConfig, LensClipRenderSettings } from "@bino-foundry/shared/types";
import { resolveAutomaticLensMaterial } from "./lens-glass-material";

/** Resolved optical settings for the replace-lens compositor. */
export type ResolvedLensClipRender = Required<
  Pick<
    LensClipRenderSettings,
    | "mode"
    | "automaticMaterialBehavior"
    | "originalLensColorInfluence"
    | "materialInfluence"
    | "baseBrightness"
    | "baseGamma"
    | "glassAbsorption"
    | "glassDiffusion"
    | "glassDepth"
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
    | "reflectionPosition"
    | "reflectionOffsetX"
    | "reflectionOffsetY"
    | "reflectionScale"
    | "internalReflectionEnabled"
    | "internalReflectionOpacity"
    | "internalReflectionSoftness"
    | "internalReflectionScale"
    | "internalReflectionAngle"
    | "fresnelEnabled"
    | "fresnelStrength"
    | "fresnelWidth"
    | "fresnelSoftness"
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
    | "edgeSoftness"
    | "edgeOpacity"
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
  automaticMaterialBehavior: true,
  originalLensColorInfluence: 15,
  materialInfluence: 35,
  baseBrightness: 0,
  baseGamma: 1,
  glassAbsorption: 30,
  glassDiffusion: 18,
  glassDepth: 50,
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
  reflectionPosition: -10,
  reflectionOffsetX: -10,
  reflectionOffsetY: -8,
  reflectionScale: 1.1,
  internalReflectionEnabled: true,
  internalReflectionOpacity: 0.04,
  internalReflectionSoftness: 0.86,
  internalReflectionScale: 0.92,
  internalReflectionAngle: 338,
  fresnelEnabled: true,
  fresnelStrength: 0.12,
  fresnelWidth: 0.18,
  fresnelSoftness: 0.72,
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
  edgeSoftness: 0.68,
  edgeOpacity: 0.24,
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
  const automaticMaterialBehavior = merged.automaticMaterialBehavior !== false;
  const automaticMaterial = automaticMaterialBehavior
    ? resolveAutomaticLensMaterial(tintLayerOpacity)
    : null;
  const configuredMaterialInfluence =
    overrides?.materialInfluence ??
    fromConfig?.materialInfluence ??
    overrides?.glassMaterialStrength ??
    fromConfig?.glassMaterialStrength;
  const configuredReflectionOffsetX =
    overrides?.reflectionOffsetX ??
    fromConfig?.reflectionOffsetX ??
    overrides?.reflectionPosition ??
    fromConfig?.reflectionPosition;
  const configuredReflectionOffsetY =
    overrides?.reflectionOffsetY ??
    fromConfig?.reflectionOffsetY ??
    overrides?.reflectionPosition ??
    fromConfig?.reflectionPosition;
  const configuredEdgeOpacity =
    overrides?.edgeOpacity ??
    fromConfig?.edgeOpacity ??
    overrides?.edgeDarkness ??
    fromConfig?.edgeDarkness;

  return {
    // Legacy overlay configs are intentionally upgraded to physical replacement at runtime.
    mode: "replace",
    automaticMaterialBehavior,
    originalLensColorInfluence: clampRange(
      merged.originalLensColorInfluence,
      DEFAULT_LENS_CLIP_RENDER.originalLensColorInfluence,
      0,
      100,
    ),
    materialInfluence: clampRange(
      automaticMaterial?.materialInfluence ?? configuredMaterialInfluence,
      DEFAULT_LENS_CLIP_RENDER.materialInfluence,
      0,
      100,
    ),
    baseBrightness: clampRange(merged.baseBrightness, 0, -100, 100),
    baseGamma: clampRange(merged.baseGamma, 1, 0.5, 2.5),
    glassAbsorption: clampRange(
      automaticMaterial?.glassAbsorption ?? merged.glassAbsorption,
      30,
      0,
      100,
    ),
    glassDiffusion: clampRange(
      automaticMaterial?.glassDiffusion ?? merged.glassDiffusion,
      18,
      0,
      100,
    ),
    glassDepth: clampRange(
      automaticMaterial?.glassDepth ?? merged.glassDepth,
      50,
      0,
      100,
    ),
    tintOpacity,
    tintLayerOpacity,
    lensOpacity: automaticMaterial?.lensOpacity ?? lensOpacity,
    lensTransmission: clamp01(
      automaticMaterial?.lensTransmission ?? lensTransmission,
      DEFAULT_LENS_CLIP_RENDER.lensTransmission,
    ),
    frameExclusionOpacity: clamp01(
      merged.frameExclusionOpacity,
      DEFAULT_LENS_CLIP_RENDER.frameExclusionOpacity,
    ),
    // Legacy aliases resolve to the one canonical replacement-material opacity.
    baseTintOpacity: automaticMaterial?.lensOpacity ?? lensOpacity,
    transparency: 1 - (automaticMaterial?.lensOpacity ?? lensOpacity),
    brightness: clampRange(merged.brightness, DEFAULT_LENS_CLIP_RENDER.brightness, 0.25, 2),
    contrast: clampRange(merged.contrast, DEFAULT_LENS_CLIP_RENDER.contrast, 0, 2),
    saturation: clampRange(merged.saturation, DEFAULT_LENS_CLIP_RENDER.saturation, 0, 2),
    gradientEnabled: merged.gradientEnabled !== false,
    gradientTopColor: merged.gradientTopColor?.trim() || null,
    gradientBottomColor: merged.gradientBottomColor?.trim() || null,
    gradientPosition: clampPct(merged.gradientPosition, DEFAULT_LENS_CLIP_RENDER.gradientPosition),
    gradientStrength: clamp01(merged.gradientStrength, DEFAULT_LENS_CLIP_RENDER.gradientStrength),
    reflectionEnabled: merged.reflectionEnabled !== false,
    reflectionStrength: clamp01(
      automaticMaterial?.reflectionStrength ?? merged.reflectionStrength,
      DEFAULT_LENS_CLIP_RENDER.reflectionStrength,
    ),
    reflectionOpacity: clamp01(
      automaticMaterial?.reflectionOpacity ?? merged.reflectionOpacity,
      DEFAULT_LENS_CLIP_RENDER.reflectionOpacity,
    ),
    reflectionAngle: normalizeAngle(
      automaticMaterial?.reflectionAngle ?? merged.reflectionAngle,
      DEFAULT_LENS_CLIP_RENDER.reflectionAngle,
    ),
    reflectionBlur: clamp01(
      automaticMaterial?.reflectionBlur ?? merged.reflectionBlur,
      DEFAULT_LENS_CLIP_RENDER.reflectionBlur,
    ),
    reflectionPosition: clampRange(
      automaticMaterial?.reflectionPosition ?? merged.reflectionPosition,
      DEFAULT_LENS_CLIP_RENDER.reflectionPosition,
      -100,
      100,
    ),
    reflectionOffsetX: clampRange(
      automaticMaterial?.reflectionOffsetX ?? configuredReflectionOffsetX,
      DEFAULT_LENS_CLIP_RENDER.reflectionOffsetX,
      -100,
      100,
    ),
    reflectionOffsetY: clampRange(
      automaticMaterial?.reflectionOffsetY ?? configuredReflectionOffsetY,
      DEFAULT_LENS_CLIP_RENDER.reflectionOffsetY,
      -100,
      100,
    ),
    reflectionScale: clampRange(
      automaticMaterial?.reflectionScale ?? merged.reflectionScale,
      DEFAULT_LENS_CLIP_RENDER.reflectionScale,
      0.5,
      1.75,
    ),
    internalReflectionEnabled: merged.internalReflectionEnabled !== false,
    internalReflectionOpacity: clamp01(
      automaticMaterial?.internalReflectionOpacity ?? merged.internalReflectionOpacity,
      DEFAULT_LENS_CLIP_RENDER.internalReflectionOpacity,
    ),
    internalReflectionSoftness: clamp01(
      automaticMaterial?.internalReflectionSoftness ?? merged.internalReflectionSoftness,
      DEFAULT_LENS_CLIP_RENDER.internalReflectionSoftness,
    ),
    internalReflectionScale: clampRange(
      automaticMaterial?.internalReflectionScale ?? merged.internalReflectionScale,
      DEFAULT_LENS_CLIP_RENDER.internalReflectionScale,
      0.5,
      1.75,
    ),
    internalReflectionAngle: normalizeAngle(
      automaticMaterial?.internalReflectionAngle ?? merged.internalReflectionAngle,
      DEFAULT_LENS_CLIP_RENDER.internalReflectionAngle,
    ),
    fresnelEnabled: merged.fresnelEnabled !== false,
    fresnelStrength: clamp01(
      automaticMaterial?.fresnelStrength ?? merged.fresnelStrength,
      DEFAULT_LENS_CLIP_RENDER.fresnelStrength,
    ),
    fresnelWidth: clamp01(
      automaticMaterial?.fresnelWidth ?? merged.fresnelWidth,
      DEFAULT_LENS_CLIP_RENDER.fresnelWidth,
    ),
    fresnelSoftness: clamp01(
      automaticMaterial?.fresnelSoftness ?? merged.fresnelSoftness,
      DEFAULT_LENS_CLIP_RENDER.fresnelSoftness,
    ),
    glossEnabled: merged.glossEnabled !== false,
    glossIntensity: glossStrength,
    glossStrength,
    vignetteEnabled: merged.vignetteEnabled !== false,
    vignetteStrength: edgeFade,
    edgeFade,
    edgeDarkness: clamp01(
      automaticMaterial?.edgeDarkness ?? merged.edgeDarkness,
      DEFAULT_LENS_CLIP_RENDER.edgeDarkness,
    ),
    edgeWidth: clampRange(merged.edgeWidth, DEFAULT_LENS_CLIP_RENDER.edgeWidth, 0, 0.05),
    backgroundVisibility: clamp01(
      automaticMaterial?.backgroundVisibility ?? merged.backgroundVisibility,
      DEFAULT_LENS_CLIP_RENDER.backgroundVisibility,
    ),
    environmentTransparency: clamp01(
      automaticMaterial?.environmentTransparency ?? merged.environmentTransparency,
      DEFAULT_LENS_CLIP_RENDER.environmentTransparency,
    ),
    centerDensity: clamp01(
      automaticMaterial?.centerDensity ?? merged.centerDensity,
      DEFAULT_LENS_CLIP_RENDER.centerDensity,
    ),
    edgeDensity: clamp01(
      automaticMaterial?.edgeDensity ?? merged.edgeDensity,
      DEFAULT_LENS_CLIP_RENDER.edgeDensity,
    ),
    edgeSoftness: clamp01(
      automaticMaterial?.edgeSoftness ?? merged.edgeSoftness,
      DEFAULT_LENS_CLIP_RENDER.edgeSoftness,
    ),
    edgeOpacity: clamp01(
      automaticMaterial?.edgeOpacity ?? configuredEdgeOpacity,
      DEFAULT_LENS_CLIP_RENDER.edgeOpacity,
    ),
    polarizedEnabled: Boolean(merged.polarizedEnabled),
    polarizedStrength: clamp01(merged.polarizedStrength, DEFAULT_LENS_CLIP_RENDER.polarizedStrength),
    tintBlendMode: merged.tintBlendMode ?? DEFAULT_LENS_CLIP_RENDER.tintBlendMode,
    highlightStrength: clamp01(merged.highlightStrength, DEFAULT_LENS_CLIP_RENDER.highlightStrength),
    highlightBlendMode: merged.highlightBlendMode ?? DEFAULT_LENS_CLIP_RENDER.highlightBlendMode,
    shadowStrength: clamp01(merged.shadowStrength, DEFAULT_LENS_CLIP_RENDER.shadowStrength),
  };
}
