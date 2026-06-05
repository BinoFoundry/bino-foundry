/**
 * Display-only viewport sizing for the bracelet builder canvas.
 * Does not affect wrist fit, pricing, or variant mm values.
 */

/** Design baseline for strand layout (see strand-layout.ts). */
export const STRAND_LAYOUT_BASELINE_PX = 260;

/** Fraction of available width/height used for the square strand canvas. */
export const STRAND_VIEWPORT_FILL = 0.96;

export const STRAND_RING_EDGE_PADDING_PX = 3;

export const STRAND_TARGET_BBOX_FILL = 0.92;

/** Max extra uniform boost when auto-fitting strand bbox into the canvas. */
export const STRAND_MAX_LAYOUT_FILL = 1.42;

export interface StrandViewportMeasureInput {
  containerWidth: number;
  containerHeight: number;
  isMobile: boolean;
  twinning: boolean;
  libraryOpen: boolean;
}

/**
 * Picks the largest square canvas that fits the builder stage while leaving room for chrome.
 */
export function measureStrandCanvasSize(input: StrandViewportMeasureInput): number {
  const { containerWidth: w, containerHeight: h, isMobile, twinning, libraryOpen } = input;
  const summaryOffset = !isMobile ? 320 : 0;

  if (isMobile) {
    if (twinning) {
      const side = Math.min((w - 16) / 2, h - 72);
      return Math.round(
        Math.max(168, Math.min(280, side * STRAND_VIEWPORT_FILL)),
      );
    }
    const side = Math.min(w - 20, h - 64);
    return Math.round(
      Math.max(220, Math.min(400, side * STRAND_VIEWPORT_FILL)),
    );
  }

  const sidebarOffset = libraryOpen ? 272 : 0;
  const availableW = w - sidebarOffset - summaryOffset - 28;
  const strandCount = twinning ? 2 : 1;
  const gap = twinning ? 24 : 0;
  const maxByWidth = (availableW - gap) / strandCount;
  const maxByHeight = h - 16;
  const side = Math.min(maxByWidth, maxByHeight) * STRAND_VIEWPORT_FILL;

  return Math.round(Math.max(300, Math.min(580, side)));
}
