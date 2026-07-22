import type { ResolvedLensClipRender } from "./clip-settings";

export type AutomaticLensMaterialValues = Pick<
  ResolvedLensClipRender,
  | "materialInfluence"
  | "glassAbsorption"
  | "glassDiffusion"
  | "glassDepth"
  | "lensOpacity"
  | "lensTransmission"
  | "reflectionOpacity"
  | "reflectionStrength"
  | "reflectionBlur"
  | "reflectionPosition"
  | "reflectionOffsetX"
  | "reflectionOffsetY"
  | "reflectionScale"
  | "reflectionAngle"
  | "internalReflectionOpacity"
  | "internalReflectionSoftness"
  | "internalReflectionScale"
  | "internalReflectionAngle"
  | "fresnelStrength"
  | "fresnelWidth"
  | "fresnelSoftness"
  | "edgeDarkness"
  | "backgroundVisibility"
  | "environmentTransparency"
  | "centerDensity"
  | "edgeDensity"
  | "edgeSoftness"
  | "edgeOpacity"
>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function mix(light: number, dark: number, density: number): number {
  return light + (dark - light) * density;
}

/**
 * Optical response derived from tint density. This changes configuration values only; it does
 * not add a renderer path or inspect the source image.
 */
export function resolveAutomaticLensMaterial(
  tintLayerOpacity: number,
): AutomaticLensMaterialValues {
  const density = clamp01(tintLayerOpacity);
  const transparencyCurve = Math.pow(1 - density, 1.2);
  return {
    materialInfluence: mix(28, 58, density),
    glassAbsorption: mix(14, 58, density),
    glassDiffusion: mix(12, 22, density),
    glassDepth: mix(32, 72, density),
    lensOpacity: mix(0.56, 0.96, density),
    lensTransmission: mix(0.74, 0.3, density),
    reflectionOpacity: mix(0.1, 0.17, density),
    reflectionStrength: mix(0.38, 0.52, density),
    reflectionBlur: mix(0.82, 0.68, density),
    reflectionPosition: mix(-12, -6, density),
    reflectionOffsetX: mix(-12, -6, density),
    reflectionOffsetY: mix(-10, -6, density),
    reflectionScale: mix(1.16, 1.08, density),
    reflectionAngle: mix(20, 24, density),
    internalReflectionOpacity: mix(0.025, 0.05, density),
    internalReflectionSoftness: mix(0.92, 0.8, density),
    internalReflectionScale: mix(1.02, 0.88, density),
    internalReflectionAngle: mix(342, 334, density),
    fresnelStrength: mix(0.07, 0.16, density),
    fresnelWidth: mix(0.13, 0.22, density),
    fresnelSoftness: mix(0.82, 0.64, density),
    edgeDarkness: mix(0.1, 0.34, density),
    backgroundVisibility: 0.34 * transparencyCurve,
    environmentTransparency: 0.38 * transparencyCurve,
    centerDensity: mix(0, 0.14, density),
    edgeDensity: mix(0.06, 0.3, density),
    edgeSoftness: mix(0.82, 0.58, density),
    edgeOpacity: mix(0.12, 0.34, density),
  };
}

/**
 * Combines the two independent manual reflection controls. Automatic tint response is resolved
 * before this function so manual mode has no hidden tint-dependent adjustment.
 */
export function resolveReflectionLayerOpacity(
  reflectionOpacity: number,
  reflectionStrength: number,
): number {
  return clamp01(reflectionOpacity) * clamp01(reflectionStrength);
}

/** Attenuates the transmitted colour body while keeping surface reflections independent. */
export function computeLensBodyOpacity(
  lensOpacity: number,
  lensTransmission: number,
): number {
  return lensOpacity * (1 - lensTransmission * 0.35);
}

export function computeLensEdgeWidthPx(
  edgeWidth: number,
  width: number,
  height: number,
): number {
  return Math.max(0.5, Math.min(width, height) * edgeWidth);
}

export function computeReflectionBlurPx(
  reflectionBlur: number,
  width: number,
  height: number,
): number {
  return reflectionBlur * Math.min(width, height) * 0.006;
}

/**
 * Optical glass compositor (bottom → top).
 * Material optics live in one reusable SVG filter applied to a single tinted path.
 */
export const REPLACE_LENS_PIPELINE_STEPS = [
  "knockout-frame-plate",
  "glass-foundation",
  "manual-base-brightness",
  "manual-base-gamma",
  "glass-tint-path",
  "glass-material-filter",
  "frame-exclusions",
] as const;

export type ReplaceLensPipelineStep = (typeof REPLACE_LENS_PIPELINE_STEPS)[number];

export interface GlassMaterialEffectsParams {
  lightScatterOpacity: number;
  absorptionOpacity: number;
  diffusionBlurFactor: number;
  depthOpacity: number;
  edgeHighlightOpacity: number;
  isIdentity: boolean;
}

export interface LensManualCalibrationParams {
  brightnessOffset: number;
  gamma: number;
  isIdentity: boolean;
}

export interface MaterialInfluenceParams {
  influence: number;
  /** Weight for mix-blend-mode:color — preserves foundation luminance under tint hue. */
  luminancePreserveFactor: number;
  /** Weight for mix-blend-mode:multiply — lets tint dominate value when influence is low. */
  valueDominanceFactor: number;
  /** Softens multiply so low influence does not crush the foundation to a flat film. */
  valueBlendGain: number;
}

/** Softens the multiply path so Material Influence 0% retains subtle glass texture. */
export const MATERIAL_INFLUENCE_VALUE_BLEND_GAIN = 0.85;

function clampUnitPercent(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value / 100 : 0));
}

/** Resolve deterministic administrator-controlled preprocessing of the original lens. */
export function resolveLensManualCalibration(
  baseBrightness: number,
  baseGamma: number,
): LensManualCalibrationParams {
  const brightness = Math.max(
    -100,
    Math.min(100, Number.isFinite(baseBrightness) ? baseBrightness : 0),
  );
  const gamma = Math.max(
    0.5,
    Math.min(2.5, Number.isFinite(baseGamma) ? baseGamma : 1),
  );
  return {
    // ±100 maps to ±50% channel offset. SVG clamps the final channel values.
    brightnessOffset: brightness / 200,
    gamma,
    isIdentity:
      Math.abs(brightness) < 1e-9 &&
      Math.abs(gamma - 1) < 1e-9,
  };
}

/**
 * Material Influence is a blend-weight control, not opacity.
 * Source chroma is handled separately. At 100%, tint hue rides on foundation luminance (`color`).
 * At 0%, tint also drives value (`multiply`) while leaving subtle texture.
 */
export function resolveMaterialInfluence(materialInfluence: number): MaterialInfluenceParams {
  const influence = clampUnitPercent(materialInfluence);
  return {
    influence,
    luminancePreserveFactor: influence,
    valueDominanceFactor: 1 - influence,
    valueBlendGain: MATERIAL_INFLUENCE_VALUE_BLEND_GAIN,
  };
}

/** Resolve independent optical depth effects after the colour-replacement tint. */
export function resolveGlassMaterialEffects(
  glassAbsorption = 0,
  glassDiffusion = 0,
  glassDepth = 0,
): GlassMaterialEffectsParams {
  const absorption = clampUnitPercent(glassAbsorption);
  const diffusion = clampUnitPercent(glassDiffusion);
  const depth = clampUnitPercent(glassDepth);

  return {
    lightScatterOpacity: diffusion * 0.18 + depth * 0.05,
    absorptionOpacity: absorption * 0.48 + depth * 0.12,
    diffusionBlurFactor: diffusion * 0.012,
    depthOpacity: depth * 0.24,
    edgeHighlightOpacity: depth * 0.18,
    isIdentity:
      absorption <= 1e-9 &&
      diffusion <= 1e-9 &&
      depth <= 1e-9,
  };
}

export interface LensGlassMaterialParams {
  bodyOpacity: number;
  edgeWidthPx: number;
  reflectionBlurPx: number;
}

export function resolveLensGlassMaterialParams(
  render: Pick<
    ResolvedLensClipRender,
    "lensOpacity" | "lensTransmission" | "edgeWidth" | "reflectionBlur"
  >,
  width: number,
  height: number,
): LensGlassMaterialParams {
  return {
    bodyOpacity: computeLensBodyOpacity(render.lensOpacity, render.lensTransmission),
    edgeWidthPx: computeLensEdgeWidthPx(render.edgeWidth, width, height),
    reflectionBlurPx: computeReflectionBlurPx(render.reflectionBlur, width, height),
  };
}
