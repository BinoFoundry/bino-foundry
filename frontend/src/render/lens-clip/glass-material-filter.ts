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

/** Resolved knobs consumed by the reusable `#glassMaterial` SVG filter. */
export interface GlassMaterialFilterParams {
  /** Overall tinted-body opacity after transmission / environment attenuation. */
  bodyOpacity: number;
  /** feColorMatrix darkening from absorption + density. */
  absorptionGain: number;
  /** Soft diffusion blur in user units. */
  diffusionBlurPx: number;
  /** Extra centre darkening (0–1). */
  centerDensity: number;
  /** Perimeter darkening strength (0–1). */
  edgeDensity: number;
  /** Edge ring feather width in user units. */
  edgeSoftnessPx: number;
  /** How much environment shows through (reduces body opacity). */
  environmentVisibility: number;
  reflection: {
    enabled: boolean;
    opacity: number;
    softBlurPx: number;
    /** Point-light position in filter primitive units (objectBoundingBox-ish via userSpace). */
    lightX: number;
    lightY: number;
    lightZ: number;
    specularConstant: number;
    specularExponent: number;
  };
}

/**
 * Map administrator / hierarchy material settings into one filter parameter set.
 * The same values drive every lens that references `url(#…-glassMaterial)`.
 */
export function resolveGlassMaterialFilterParams(
  render: ResolvedLensClipRender,
  width: number,
  height: number,
): GlassMaterialFilterParams {
  const glass = resolveGlassMaterialEffects(
    render.glassAbsorption,
    render.glassDiffusion,
    render.glassDepth,
  );
  const environmentVisibility = clamp01(
    Math.max(render.environmentTransparency, render.backgroundVisibility * 0.5),
  );
  const bodyOpacity =
    computeLensBodyOpacity(render.lensOpacity, render.lensTransmission) *
    (1 - environmentVisibility) *
    clamp01(render.tintLayerOpacity);
  const minDim = Math.min(width, height);
  const edgeSoftnessPx = Math.max(0.5, render.edgeSoftness * minDim * 0.04);
  const reflectionOpacity = resolveReflectionLayerOpacity(
    render.reflectionOpacity,
    render.reflectionStrength,
  );
  const softBlurPx = computeReflectionBlurPx(render.reflectionBlur, width, height);

  // Map admin offsets (−100…100) and rotation onto a studio catch-light.
  const angleRad = (render.reflectionAngle * Math.PI) / 180;
  const orbit = 0.22 * render.reflectionScale;
  const ox = render.reflectionOffsetX / 100;
  const oy = render.reflectionOffsetY / 100;
  const lightX = width * (0.5 + ox * 0.28 + Math.cos(angleRad) * orbit);
  const lightY = height * (0.38 + oy * 0.22 + Math.sin(angleRad) * orbit * 0.75);
  const lightZ = Math.max(12, minDim * 0.22 * render.reflectionScale);

  return {
    bodyOpacity,
    absorptionGain: clamp01(
      glass.absorptionOpacity + glass.depthOpacity * 0.55 + render.centerDensity * 0.25,
    ),
    diffusionBlurPx: Math.max(0, glass.diffusionBlurFactor * minDim),
    centerDensity: clamp01(render.centerDensity),
    edgeDensity: clamp01(render.edgeDensity) * clamp01(render.edgeOpacity),
    edgeSoftnessPx,
    environmentVisibility,
    reflection: {
      enabled: render.reflectionEnabled && reflectionOpacity > 1e-4,
      opacity: reflectionOpacity,
      softBlurPx,
      lightX,
      lightY,
      lightZ,
      specularConstant: 0.35 + reflectionOpacity * 0.9,
      specularExponent: 8 + (1 - clamp01(render.reflectionBlur)) * 28,
    },
  };
}
