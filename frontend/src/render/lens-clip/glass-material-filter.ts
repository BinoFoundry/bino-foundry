import type { LensClipShape } from "@bino-foundry/shared/types";
import type { ResolvedLensClipRender } from "./clip-settings";
import {
  computeLensBodyOpacity,
  computeReflectionBlurPx,
  resolveGlassMaterialEffects,
  resolveReflectionLayerOpacity,
} from "./lens-glass-material";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

export type LensReflectionSide = "left" | "right";

export interface LensPathBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/** Rough axis-aligned bounds from SVG path numbers (good enough for catch-light placement). */
export function approximatePathBounds(pathD: string): LensPathBounds {
  const nums = (pathD.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number).filter(Number.isFinite);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!;
    const y = nums[i + 1]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, cx: 0.5, cy: 0.5, width: 1, height: 1 };
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width,
    height,
  };
}

/** Classify a lens as left/right from id/label, else by horizontal centre among siblings. */
export function resolveLensReflectionSide(
  lens: LensClipShape,
  lenses: LensClipShape[],
): LensReflectionSide {
  const key = `${lens.id} ${lens.label}`.toLowerCase();
  if (/\bleft\b/.test(key)) return "left";
  if (/\bright\b/.test(key)) return "right";
  if (lenses.length < 2) return "left";
  const ranked = lenses
    .map((item) => ({ id: item.id, cx: approximatePathBounds(item.pathD).cx }))
    .sort((a, b) => a.cx - b.cx);
  return ranked[0]?.id === lens.id ? "left" : "right";
}

/**
 * Optical density from Base Glass Darkness (0–1).
 * Never applied as a flat multiply on tint opacity / HEX.
 */
export function resolveBaseGlassDarknessAmount(baseGlassDarkness: number): number {
  return clamp01(baseGlassDarkness / 100);
}

/**
 * Material richness contribution (0–1) — depth / thickness feel, independent of tint.
 */
export function resolveBaseGlassRichnessAmount(baseGlassRichness: number): number {
  return clamp01(baseGlassRichness / 100);
}

/** Chroma retained after neutralization (0–1). 0 neutralization → keep original colour. */
export function resolveSourceChromaRetain(baseGlassNeutralization: number): number {
  return clamp01(1 - baseGlassNeutralization / 100);
}

/** @deprecated Prefer resolveBaseGlassDarknessAmount + resolveBaseGlassRichnessAmount. */
export function resolveAppliedGlassBaseDensity(
  glassBaseDensity: number,
  baseDensityBias: number,
): number {
  const density = resolveBaseGlassDarknessAmount(glassBaseDensity);
  const richness = resolveBaseGlassRichnessAmount(baseDensityBias);
  return density * (0.28 + 0.72 * richness);
}

export interface ReflectionTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
  angle: number;
}

export interface ReflectionAppearance {
  opacity: number;
  softBlur: number;
}

/** Resolve left/right reflection transforms with optional mirroring. */
export function resolveReflectionTransformForSide(
  render: Pick<
    ResolvedLensClipRender,
    | "mirrorReflection"
    | "reflectionAngle"
    | "reflectionOffsetX"
    | "reflectionOffsetY"
    | "reflectionScale"
    | "reflectionRightAngle"
    | "reflectionRightOffsetX"
    | "reflectionRightOffsetY"
    | "reflectionRightScale"
  >,
  side: LensReflectionSide,
): ReflectionTransform {
  const left: ReflectionTransform = {
    offsetX: render.reflectionOffsetX,
    offsetY: render.reflectionOffsetY,
    scale: render.reflectionScale,
    angle: render.reflectionAngle,
  };
  if (side === "left") return left;
  if (render.mirrorReflection) {
    return {
      offsetX: -left.offsetX,
      offsetY: left.offsetY,
      scale: left.scale,
      angle: (360 - left.angle) % 360,
    };
  }
  return {
    offsetX: render.reflectionRightOffsetX,
    offsetY: render.reflectionRightOffsetY,
    scale: render.reflectionRightScale,
    angle: render.reflectionRightAngle,
  };
}

/** Resolve left/right reflection opacity + softness with optional mirroring. */
export function resolveReflectionAppearanceForSide(
  render: Pick<
    ResolvedLensClipRender,
    | "mirrorReflection"
    | "reflectionOpacity"
    | "reflectionBlur"
    | "reflectionStrength"
    | "reflectionRightOpacity"
    | "reflectionRightBlur"
  >,
  side: LensReflectionSide,
): ReflectionAppearance {
  if (side === "left" || render.mirrorReflection) {
    return {
      opacity: resolveReflectionLayerOpacity(render.reflectionOpacity, render.reflectionStrength),
      softBlur: render.reflectionBlur,
    };
  }
  return {
    opacity: resolveReflectionLayerOpacity(
      render.reflectionRightOpacity,
      render.reflectionStrength,
    ),
    softBlur: render.reflectionRightBlur,
  };
}

/** Resolved knobs consumed by `#glassMaterial` — one instance per lens opening. */
export interface GlassMaterialFilterParams {
  bodyOpacity: number;
  absorptionGain: number;
  diffusionBlurPx: number;
  centerDensity: number;
  edgeDensity: number;
  edgeSoftnessPx: number;
  environmentVisibility: number;
  /** Extra foundation darkening from Base Glass Darkness (0–1). */
  baseDensityDarken: number;
  /** Multiplier for plate foundation visibility (transmission through base glass). */
  foundationTransmission: number;
  /** Extra depth / thickness from Base Glass Richness (0–1). */
  richnessDepth: number;
  reflection: {
    enabled: boolean;
    opacity: number;
    softBlurPx: number;
    lightX: number;
    lightY: number;
    lightZ: number;
    specularConstant: number;
    specularExponent: number;
  };
}

/**
 * Map administrator / hierarchy material settings into one filter parameter set
 * for a single lens polygon (reflection is always local to that opening).
 */
export function resolveGlassMaterialFilterParams(
  render: ResolvedLensClipRender,
  width: number,
  height: number,
  lens?: LensClipShape,
  lenses: LensClipShape[] = lens ? [lens] : [],
): GlassMaterialFilterParams {
  const glass = resolveGlassMaterialEffects(
    render.glassAbsorption,
    render.glassDiffusion,
    render.glassDepth,
  );
  const darkness = resolveBaseGlassDarknessAmount(render.baseGlassDarkness);
  const richness = resolveBaseGlassRichnessAmount(render.baseGlassRichness);
  const environmentVisibility = clamp01(
    Math.max(render.environmentTransparency, render.backgroundVisibility * 0.5),
  );
  // Darkness reduces transmission optically — not by multiplying tint opacity / HEX.
  const effectiveTransmission = clamp01(render.lensTransmission * (1 - darkness * 0.55));
  const bodyOpacity =
    computeLensBodyOpacity(render.lensOpacity, effectiveTransmission) *
    (1 - environmentVisibility) *
    clamp01(render.tintLayerOpacity);
  const minDim = Math.min(width, height);
  const edgeSoftnessPx = Math.max(0.5, render.edgeSoftness * minDim * 0.04);

  const side = lens ? resolveLensReflectionSide(lens, lenses.length ? lenses : [lens]) : "left";
  const transform = resolveReflectionTransformForSide(render, side);
  const appearance = resolveReflectionAppearanceForSide(render, side);
  const softBlurPx = computeReflectionBlurPx(appearance.softBlur, width, height);
  const reflectionOpacity = appearance.opacity;

  const bounds = lens ? approximatePathBounds(lens.pathD) : null;
  const cx = bounds?.cx ?? width * 0.5;
  const cy = bounds?.cy ?? height * 0.42;
  const localW = bounds?.width ?? width * 0.42;
  const localH = bounds?.height ?? height * 0.55;
  const localMin = Math.min(localW, localH);

  const angleRad = (transform.angle * Math.PI) / 180;
  const orbit = 0.22 * transform.scale;
  const ox = transform.offsetX / 100;
  const oy = transform.offsetY / 100;
  const lightX = cx + localW * (ox * 0.28 + Math.cos(angleRad) * orbit);
  const lightY = cy + localH * (oy * 0.22 + Math.sin(angleRad) * orbit * 0.75);
  const lightZ = Math.max(10, localMin * 0.28 * transform.scale);

  return {
    bodyOpacity,
    absorptionGain: clamp01(
      glass.absorptionOpacity +
        glass.depthOpacity * 0.55 +
        render.centerDensity * 0.25 +
        darkness * 0.38 +
        richness * 0.22,
    ),
    diffusionBlurPx: Math.max(
      0,
      (glass.diffusionBlurFactor + richness * 0.012) * minDim,
    ),
    centerDensity: clamp01(render.centerDensity + darkness * 0.1 + richness * 0.14),
    edgeDensity: clamp01(
      clamp01(render.edgeDensity) * clamp01(render.edgeOpacity) + richness * 0.08,
    ),
    edgeSoftnessPx: edgeSoftnessPx * (1 + richness * 0.15),
    environmentVisibility,
    baseDensityDarken: darkness * 0.38,
    foundationTransmission: clamp01(1 - darkness * 0.52),
    richnessDepth: richness,
    reflection: {
      enabled: render.reflectionEnabled && reflectionOpacity > 1e-4,
      opacity: reflectionOpacity,
      softBlurPx,
      lightX,
      lightY,
      lightZ,
      specularConstant: 0.35 + reflectionOpacity * 0.9,
      specularExponent: 8 + (1 - clamp01(appearance.softBlur)) * 28,
    },
  };
}
