import type { ResolvedLensClipRender } from "./clip-settings";

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
 * Layered lens compositor contract (bottom → top).
 * The original lens plate always stays in the customer stack for real glass texture,
 * lighting, and depth. Admin preview may temporarily hide that layer for comparison.
 * Parameters only tune opacities — they never replace this pipeline.
 */
export const REPLACE_LENS_PIPELINE_STEPS = [
  "knockout-frame-plate",
  "original-lens",
  "tint-layer",
  "density-modifiers",
  "surface-reflection",
  "edge-rim",
  "frame-exclusions",
] as const;

export type ReplaceLensPipelineStep = (typeof REPLACE_LENS_PIPELINE_STEPS)[number];

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
