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
    | "glassTintBlend"
    | "glassTintShine"
    | "glassTintEnabled"
    | "darkLayerEnabled"
    | "darkLayerOpacity"
    | "darkLayerMode"
    | "darkLayerColor"
    | "darkLayerBlend"
    | "darkLayerGlow"
    | "darkLayerGlowSize"
    | "darkLayerGlowX"
    | "darkLayerGlowY"
    | "darkLayerSoft"
    | "darkLayerEdge"
    | "edgeEnabled"
    | "densityGradientEnabled"
    | "densityGradientMode"
    | "densityGradientAngle"
    | "densityGradientTwoColor"
    | "densityGradientStrength"
    | "densityGradientSoftness"
    | "densityGradientPosition"
    | "densityGradientStartFalloff"
    | "densityGradientEndFalloff"
    | "densityGradientCurve"
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
    | "mirrorReflection"
    | "reflectionRightAngle"
    | "reflectionRightOffsetX"
    | "reflectionRightOffsetY"
    | "reflectionRightScale"
    | "reflectionRightOpacity"
    | "reflectionRightBlur"
    | "baseGlassDarkness"
    | "baseGlassRichness"
    | "baseGlassNeutralization"
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
    | "glassSheetEnabled"
    | "glassSheetFit"
    | "glassSheetScale"
    | "glassSheetOffsetX"
    | "glassSheetOffsetY"
    | "glassSheetColorStrength"
    | "glassSheetTextureStrength"
    | "glassSheetShine"
    | "glassSheetOccluderEnabled"
    | "glassSheetOccluderStrength"
    | "glassSheetOccluderThreshold"
    | "innerFrameEnabled"
    | "innerFrameThickness"
    | "innerFrameOpacity"
    | "innerFrameFeather"
    | "innerFrameBlendMode"
    | "glassCompositionOrder"
    | "glassBaseSource"
    | "glassDebugStage"
  >
> & {
  gradientTopColor: string | null;
  gradientBottomColor: string | null;
  densityGradientStartColor: string | null;
  densityGradientEndColor: string | null;
  glassSheetUrl: string | null;
  glassSheetNaturalWidth: number | null;
  glassSheetNaturalHeight: number | null;
  glassSheetCrop: NonNullable<LensClipRenderSettings["glassSheetCrop"]> | null;
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
  glassTintBlend: "kaca",
  glassTintShine: 55,
  glassTintEnabled: true,
  darkLayerEnabled: true,
  darkLayerOpacity: 28,
  darkLayerMode: "gradasi",
  darkLayerColor: "#0A0A0A",
  darkLayerBlend: "source-over",
  darkLayerGlow: 42,
  darkLayerGlowSize: 55,
  darkLayerGlowX: 45,
  darkLayerGlowY: 34,
  darkLayerSoft: 70,
  darkLayerEdge: 0,
  edgeEnabled: true,
  densityGradientEnabled: false,
  densityGradientMode: "vertical",
  densityGradientAngle: 90,
  densityGradientTwoColor: true,
  densityGradientStartColor: "#1E1E1E",
  densityGradientEndColor: "#4B4B4B",
  densityGradientStrength: 45,
  densityGradientSoftness: 55,
  densityGradientPosition: 45,
  densityGradientStartFalloff: 50,
  densityGradientEndFalloff: 50,
  densityGradientCurve: "linear",
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
  mirrorReflection: true,
  reflectionRightAngle: 338,
  reflectionRightOffsetX: 10,
  reflectionRightOffsetY: -8,
  reflectionRightScale: 1.1,
  reflectionRightOpacity: 0.2,
  reflectionRightBlur: 0.58,
  baseGlassDarkness: 28,
  baseGlassRichness: 55,
  baseGlassNeutralization: 85,
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
  glassSheetEnabled: false,
  glassSheetUrl: null,
  glassSheetNaturalWidth: null,
  glassSheetNaturalHeight: null,
  glassSheetCrop: null,
  glassSheetFit: "cover",
  glassSheetScale: 1,
  glassSheetOffsetX: 0,
  glassSheetOffsetY: 0,
  glassSheetColorStrength: 85,
  glassSheetTextureStrength: 55,
  glassSheetShine: 40,
  glassSheetOccluderEnabled: false,
  glassSheetOccluderStrength: 70,
  glassSheetOccluderThreshold: 42,
  innerFrameEnabled: true,
  innerFrameThickness: 2,
  innerFrameOpacity: 70,
  innerFrameFeather: 25,
  innerFrameBlendMode: "normal",
  glassCompositionOrder: "hybrid",
  glassBaseSource: "canvas",
  glassDebugStage: "full",
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

  // Prefer Base Glass Neutralization; fall back to legacy influence (inverted).
  const configuredNeutralization =
    overrides?.baseGlassNeutralization ??
    fromConfig?.baseGlassNeutralization ??
    (overrides?.originalLensColorInfluence != null
      ? 100 - overrides.originalLensColorInfluence
      : undefined) ??
    (fromConfig?.originalLensColorInfluence != null
      ? 100 - fromConfig.originalLensColorInfluence
      : undefined);
  const baseGlassNeutralization = clampPct(
    configuredNeutralization,
    DEFAULT_LENS_CLIP_RENDER.baseGlassNeutralization,
  );
  const baseGlassDarkness = clampPct(
    overrides?.baseGlassDarkness ??
      fromConfig?.baseGlassDarkness ??
      overrides?.glassBaseDensity ??
      fromConfig?.glassBaseDensity,
    DEFAULT_LENS_CLIP_RENDER.baseGlassDarkness,
  );
  const baseGlassRichness = clampPct(
    overrides?.baseGlassRichness ??
      fromConfig?.baseGlassRichness ??
      overrides?.baseDensityBias ??
      fromConfig?.baseDensityBias,
    DEFAULT_LENS_CLIP_RENDER.baseGlassRichness,
  );

  return {
    // Legacy overlay configs are intentionally upgraded to physical replacement at runtime.
    mode: "replace",
    automaticMaterialBehavior,
    // Kept in sync for any legacy readers; compositor uses baseGlassNeutralization.
    originalLensColorInfluence: 100 - baseGlassNeutralization,
    baseGlassDarkness,
    baseGlassRichness,
    baseGlassNeutralization,
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
    darkLayerOpacity: clampPct(
      overrides?.darkLayerOpacity ??
        fromConfig?.darkLayerOpacity ??
        overrides?.baseGlassDarkness ??
        fromConfig?.baseGlassDarkness ??
        overrides?.glassBaseDensity ??
        fromConfig?.glassBaseDensity,
      DEFAULT_LENS_CLIP_RENDER.darkLayerOpacity,
    ),
    darkLayerMode:
      (overrides?.darkLayerMode ?? fromConfig?.darkLayerMode) === "flat" ? "flat" : "gradasi",
    darkLayerColor: (() => {
      const raw = overrides?.darkLayerColor ?? fromConfig?.darkLayerColor;
      return typeof raw === "string" && /^#[0-9A-Fa-f]{6}$/.test(raw.trim())
        ? raw.trim().toUpperCase()
        : DEFAULT_LENS_CLIP_RENDER.darkLayerColor;
    })(),
    darkLayerBlend:
      (overrides?.darkLayerBlend ?? fromConfig?.darkLayerBlend) === "multiply"
        ? "multiply"
        : "source-over",
    darkLayerGlow: clampPct(
      overrides?.darkLayerGlow ?? fromConfig?.darkLayerGlow,
      DEFAULT_LENS_CLIP_RENDER.darkLayerGlow,
    ),
    darkLayerGlowSize: clampPct(
      overrides?.darkLayerGlowSize ?? fromConfig?.darkLayerGlowSize,
      DEFAULT_LENS_CLIP_RENDER.darkLayerGlowSize,
    ),
    darkLayerGlowX: clampPct(
      overrides?.darkLayerGlowX ?? fromConfig?.darkLayerGlowX,
      DEFAULT_LENS_CLIP_RENDER.darkLayerGlowX,
    ),
    darkLayerGlowY: clampPct(
      overrides?.darkLayerGlowY ?? fromConfig?.darkLayerGlowY,
      DEFAULT_LENS_CLIP_RENDER.darkLayerGlowY,
    ),
    darkLayerSoft: clampPct(
      overrides?.darkLayerSoft ?? fromConfig?.darkLayerSoft,
      DEFAULT_LENS_CLIP_RENDER.darkLayerSoft,
    ),
    darkLayerEdge: clampPct(
      overrides?.darkLayerEdge ?? fromConfig?.darkLayerEdge,
      DEFAULT_LENS_CLIP_RENDER.darkLayerEdge,
    ),
    edgeEnabled: (overrides?.edgeEnabled ?? fromConfig?.edgeEnabled) !== false,
    // Optional gradient on the replacement glass surface (not the original lens).
    densityGradientEnabled: Boolean(
      overrides?.densityGradientEnabled ?? fromConfig?.densityGradientEnabled,
    ),
    densityGradientMode: (() => {
      const mode = overrides?.densityGradientMode ?? fromConfig?.densityGradientMode;
      return mode === "horizontal" ||
        mode === "radial" ||
        mode === "angle" ||
        mode === "none" ||
        mode === "vertical"
        ? mode
        : DEFAULT_LENS_CLIP_RENDER.densityGradientMode;
    })(),
    densityGradientAngle: normalizeAngle(
      overrides?.densityGradientAngle ?? fromConfig?.densityGradientAngle,
      DEFAULT_LENS_CLIP_RENDER.densityGradientAngle,
    ),
    densityGradientTwoColor:
      (overrides?.densityGradientTwoColor ?? fromConfig?.densityGradientTwoColor) !== false,
    densityGradientStartColor: (() => {
      const raw =
        overrides?.densityGradientStartColor ?? fromConfig?.densityGradientStartColor;
      return typeof raw === "string" && /^#[0-9A-Fa-f]{6}$/.test(raw.trim())
        ? raw.trim().toUpperCase()
        : DEFAULT_LENS_CLIP_RENDER.densityGradientStartColor;
    })(),
    densityGradientEndColor: (() => {
      const raw =
        overrides?.densityGradientEndColor ?? fromConfig?.densityGradientEndColor;
      return typeof raw === "string" && /^#[0-9A-Fa-f]{6}$/.test(raw.trim())
        ? raw.trim().toUpperCase()
        : DEFAULT_LENS_CLIP_RENDER.densityGradientEndColor;
    })(),
    densityGradientStrength: clampPct(
      overrides?.densityGradientStrength ?? fromConfig?.densityGradientStrength,
      DEFAULT_LENS_CLIP_RENDER.densityGradientStrength,
    ),
    densityGradientSoftness: clampPct(
      overrides?.densityGradientSoftness ?? fromConfig?.densityGradientSoftness,
      DEFAULT_LENS_CLIP_RENDER.densityGradientSoftness,
    ),
    densityGradientPosition: clampPct(
      overrides?.densityGradientPosition ?? fromConfig?.densityGradientPosition,
      DEFAULT_LENS_CLIP_RENDER.densityGradientPosition,
    ),
    densityGradientStartFalloff: clampPct(
      overrides?.densityGradientStartFalloff ??
        fromConfig?.densityGradientStartFalloff ??
        overrides?.densityGradientStrength ??
        fromConfig?.densityGradientStrength,
      DEFAULT_LENS_CLIP_RENDER.densityGradientStartFalloff,
    ),
    densityGradientEndFalloff: clampPct(
      overrides?.densityGradientEndFalloff ??
        fromConfig?.densityGradientEndFalloff ??
        overrides?.densityGradientStrength ??
        fromConfig?.densityGradientStrength,
      DEFAULT_LENS_CLIP_RENDER.densityGradientEndFalloff,
    ),
    densityGradientCurve: (() => {
      const curve = overrides?.densityGradientCurve ?? fromConfig?.densityGradientCurve;
      return curve === "ease-in" ||
        curve === "ease-out" ||
        curve === "ease-in-out" ||
        curve === "linear"
        ? curve
        : DEFAULT_LENS_CLIP_RENDER.densityGradientCurve;
    })(),
    glassTintBlend: (() => {
      const blend = overrides?.glassTintBlend ?? fromConfig?.glassTintBlend;
      return blend === "color" || blend === "source-over" || blend === "multiply" ? blend : "kaca";
    })(),
    glassTintShine: clampPct(
      overrides?.glassTintShine ?? fromConfig?.glassTintShine,
      DEFAULT_LENS_CLIP_RENDER.glassTintShine,
    ),
    glassTintEnabled: (overrides?.glassTintEnabled ?? fromConfig?.glassTintEnabled) !== false,
    darkLayerEnabled: (overrides?.darkLayerEnabled ?? fromConfig?.darkLayerEnabled) !== false,
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
    // Geometry stays administrator-controlled so per-lens catch-lights can be calibrated.
    reflectionAngle: normalizeAngle(
      merged.reflectionAngle,
      DEFAULT_LENS_CLIP_RENDER.reflectionAngle,
    ),
    reflectionBlur: clamp01(
      automaticMaterial?.reflectionBlur ?? merged.reflectionBlur,
      DEFAULT_LENS_CLIP_RENDER.reflectionBlur,
    ),
    reflectionPosition: clampRange(
      merged.reflectionPosition,
      DEFAULT_LENS_CLIP_RENDER.reflectionPosition,
      -100,
      100,
    ),
    reflectionOffsetX: clampRange(
      configuredReflectionOffsetX,
      DEFAULT_LENS_CLIP_RENDER.reflectionOffsetX,
      -100,
      100,
    ),
    reflectionOffsetY: clampRange(
      configuredReflectionOffsetY,
      DEFAULT_LENS_CLIP_RENDER.reflectionOffsetY,
      -100,
      100,
    ),
    reflectionScale: clampRange(
      merged.reflectionScale,
      DEFAULT_LENS_CLIP_RENDER.reflectionScale,
      0.5,
      1.75,
    ),
    mirrorReflection: merged.mirrorReflection !== false,
    reflectionRightAngle: normalizeAngle(
      merged.reflectionRightAngle,
      DEFAULT_LENS_CLIP_RENDER.reflectionRightAngle,
    ),
    reflectionRightOffsetX: clampRange(
      merged.reflectionRightOffsetX,
      DEFAULT_LENS_CLIP_RENDER.reflectionRightOffsetX,
      -100,
      100,
    ),
    reflectionRightOffsetY: clampRange(
      merged.reflectionRightOffsetY,
      DEFAULT_LENS_CLIP_RENDER.reflectionRightOffsetY,
      -100,
      100,
    ),
    reflectionRightScale: clampRange(
      merged.reflectionRightScale,
      DEFAULT_LENS_CLIP_RENDER.reflectionRightScale,
      0.5,
      1.75,
    ),
    reflectionRightOpacity: clamp01(
      merged.reflectionRightOpacity,
      DEFAULT_LENS_CLIP_RENDER.reflectionRightOpacity,
    ),
    reflectionRightBlur: clamp01(
      merged.reflectionRightBlur,
      DEFAULT_LENS_CLIP_RENDER.reflectionRightBlur,
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
    // How much of what sits behind the lens survives the glass substrate.
    // 0 keeps the fully opaque plate; 1 is clear glass. Environment transmission
    // stays retired — it belonged to the withdrawn Glass Sheet path.
    backgroundVisibility: clamp01(
      merged.backgroundVisibility,
      DEFAULT_LENS_CLIP_RENDER.backgroundVisibility,
    ),
    environmentTransparency: 0,
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
    glassSheetUrl: typeof merged.glassSheetUrl === "string" && merged.glassSheetUrl.trim()
      ? merged.glassSheetUrl.trim()
      : null,
    // Deprecated flag — kept in sync with URL so legacy readers still see "enabled".
    glassSheetEnabled: Boolean(
      typeof merged.glassSheetUrl === "string" && merged.glassSheetUrl.trim(),
    ),
    glassSheetNaturalWidth:
      merged.glassSheetNaturalWidth != null && Number.isFinite(merged.glassSheetNaturalWidth)
        ? Math.max(1, merged.glassSheetNaturalWidth)
        : null,
    glassSheetNaturalHeight:
      merged.glassSheetNaturalHeight != null && Number.isFinite(merged.glassSheetNaturalHeight)
        ? Math.max(1, merged.glassSheetNaturalHeight)
        : null,
    glassSheetCrop: (() => {
      const crop = merged.glassSheetCrop;
      if (!crop || typeof crop !== "object") return null;
      const x = clamp01(crop.x, 0);
      const y = clamp01(crop.y, 0);
      const width = clamp01(crop.width, 1);
      const height = clamp01(crop.height, 1);
      if (width < 0.01 || height < 0.01) return null;
      return {
        x: Math.min(x, 1 - width),
        y: Math.min(y, 1 - height),
        width,
        height,
      };
    })(),
    glassSheetFit: merged.glassSheetFit === "contain" ? "contain" : "cover",
    glassSheetScale: clampRange(merged.glassSheetScale, DEFAULT_LENS_CLIP_RENDER.glassSheetScale, 0.25, 3),
    glassSheetOffsetX: clampRange(
      merged.glassSheetOffsetX,
      DEFAULT_LENS_CLIP_RENDER.glassSheetOffsetX,
      -100,
      100,
    ),
    glassSheetOffsetY: clampRange(
      merged.glassSheetOffsetY,
      DEFAULT_LENS_CLIP_RENDER.glassSheetOffsetY,
      -100,
      100,
    ),
    glassSheetColorStrength: clampPct(
      merged.glassSheetColorStrength,
      DEFAULT_LENS_CLIP_RENDER.glassSheetColorStrength,
    ),
    glassSheetTextureStrength: clampPct(
      merged.glassSheetTextureStrength,
      DEFAULT_LENS_CLIP_RENDER.glassSheetTextureStrength,
    ),
    glassSheetShine: clampPct(merged.glassSheetShine, DEFAULT_LENS_CLIP_RENDER.glassSheetShine),
    glassSheetOccluderEnabled: Boolean(merged.glassSheetOccluderEnabled),
    glassSheetOccluderStrength: clampPct(
      merged.glassSheetOccluderStrength,
      DEFAULT_LENS_CLIP_RENDER.glassSheetOccluderStrength,
    ),
    glassSheetOccluderThreshold: clampPct(
      merged.glassSheetOccluderThreshold,
      DEFAULT_LENS_CLIP_RENDER.glassSheetOccluderThreshold,
    ),
    innerFrameEnabled: merged.innerFrameEnabled !== false,
    innerFrameThickness: clampRange(
      merged.innerFrameThickness,
      DEFAULT_LENS_CLIP_RENDER.innerFrameThickness,
      0,
      8,
    ),
    innerFrameOpacity: clampPct(
      merged.innerFrameOpacity,
      DEFAULT_LENS_CLIP_RENDER.innerFrameOpacity,
    ),
    innerFrameFeather: clampPct(
      merged.innerFrameFeather,
      DEFAULT_LENS_CLIP_RENDER.innerFrameFeather,
    ),
    innerFrameBlendMode: (() => {
      const mode = merged.innerFrameBlendMode;
      return mode === "multiply" || mode === "overlay" || mode === "screen" || mode === "normal"
        ? mode
        : DEFAULT_LENS_CLIP_RENDER.innerFrameBlendMode;
    })(),
    glassCompositionOrder:
      merged.glassCompositionOrder === "under-frame" ||
      merged.glassCompositionOrder === "over-surface" ||
      merged.glassCompositionOrder === "hybrid"
        ? merged.glassCompositionOrder
        : DEFAULT_LENS_CLIP_RENDER.glassCompositionOrder,
    glassBaseSource: (() => {
      // Prefer config/override only — DEFAULT is "canvas" and must not block sheet auto-select.
      const explicit = overrides?.glassBaseSource ?? fromConfig?.glassBaseSource;
      const sheetUrl = overrides?.glassSheetUrl ?? fromConfig?.glassSheetUrl ?? merged.glassSheetUrl;
      const hasSheet = typeof sheetUrl === "string" && Boolean(sheetUrl.trim());
      if (explicit === "canvas") return "canvas";
      if (explicit === "sheet") return hasSheet ? "sheet" : "canvas";
      return hasSheet ? "sheet" : "canvas";
    })(),
    glassDebugStage:
      merged.glassDebugStage === "original" ||
      merged.glassDebugStage === "glass-base" ||
      merged.glassDebugStage === "glass-tint" ||
      merged.glassDebugStage === "full"
        ? merged.glassDebugStage
        : DEFAULT_LENS_CLIP_RENDER.glassDebugStage,
    tintBlendMode: merged.tintBlendMode ?? DEFAULT_LENS_CLIP_RENDER.tintBlendMode,
    highlightStrength: clamp01(merged.highlightStrength, DEFAULT_LENS_CLIP_RENDER.highlightStrength),
    highlightBlendMode: merged.highlightBlendMode ?? DEFAULT_LENS_CLIP_RENDER.highlightBlendMode,
    shadowStrength: clamp01(merged.shadowStrength, DEFAULT_LENS_CLIP_RENDER.shadowStrength),
  };
}
