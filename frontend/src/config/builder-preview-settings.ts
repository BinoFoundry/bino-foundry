/**
 * Centralized preview framing for customer builders.
 * Controls how much of the preview container the rendered output may occupy (layout only).
 */

export type PreviewFitTier = "mobile" | "tablet" | "laptop" | "largeLaptop" | "desktop";

export type BuilderPreviewFitKey = "bracelet" | "sunglasses";

export type BuilderPreviewFitConfig = Record<PreviewFitTier, number>;

/** Percent of preview container width/height the rendered output may use (0–100). */
export const BUILDER_PREVIEW_SETTINGS: Record<BuilderPreviewFitKey, BuilderPreviewFitConfig> = {
  /** Slightly wider framing — comfortable whitespace around the frame. */
  sunglasses: {
    mobile: 95,
    tablet: 90,
    laptop: 86,
    largeLaptop: 84,
    desktop: 82,
  },
  /** Slightly closer framing — strand fills a bit more of the canvas. */
  bracelet: {
    mobile: 97,
    tablet: 92,
    laptop: 88,
    largeLaptop: 86,
    desktop: 84,
  },
};

export const BUILDER_PREVIEW_FIT_CSS_VAR = "--builder-preview-fit";

export function previewFitPercentForTier(
  builder: BuilderPreviewFitKey,
  tier: PreviewFitTier,
): number {
  return BUILDER_PREVIEW_SETTINGS[builder][tier];
}

export function formatPreviewFitCss(percent: number): string {
  return `${percent}%`;
}
