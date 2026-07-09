/**
 * Display-only viewport sizing for the bracelet builder canvas.
 * Does not affect wrist fit, pricing, or variant mm values.
 */

/** Design baseline for strand layout (see strand-layout.ts). */
export const STRAND_LAYOUT_BASELINE_PX = 260;

/** Minimal padding around the strand bounding box — prevents edge clipping only. */
export const STRAND_CONTENT_PADDING_PX = 8;

/** Fraction of available width/height used for the square strand canvas. */
export const STRAND_VIEWPORT_FILL = 1;

export const STRAND_RING_EDGE_PADDING_PX = 2;

export const STRAND_TARGET_BBOX_FILL = 0.96;

/** Max extra uniform boost when auto-fitting strand bbox into the canvas. */
export const STRAND_MAX_LAYOUT_FILL = 1.28;

/** Horizontal gap between twin strand canvases in the preview row. */
export const TWIN_STRAND_PREVIEW_GAP_PX = 12;

/** Strand zoom clamps — keep in sync with useStrandZoom.ts */
export const STRAND_ZOOM_MIN = 0.55;
export const STRAND_ZOOM_MAX = 3;

/** Target effective scale (autoFit × userZoom) on a laptop-width builder stage. */
export const STRAND_EFFECTIVE_ZOOM_TARGET = 1.56;
const LAPTOP_REF_WIDTH_PX = 1120;

function clampStrandZoom(value: number): number {
  return Math.max(STRAND_ZOOM_MIN, Math.min(STRAND_ZOOM_MAX, value));
}

/**
 * Viewport-aware multiplier for default strand zoom.
 * Laptop ≈ 1.0; large desktop slightly larger; mobile/tablet ease back to prevent clipping.
 */
export function viewportStrandZoomFactor(
  containerWidth: number,
  containerHeight: number,
  isMobile: boolean,
  _twinning = false,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 1;

  const shortest = Math.min(containerWidth, containerHeight);

  if (isMobile) {
    const floor = 0.88;
    const t = Math.min(1, shortest / 400);
    return floor + (1 - floor) * t;
  }

  let factor = 1;

  if (containerWidth >= 1560) factor *= 1.06;
  else if (containerWidth >= 1400) factor *= 1.03;

  if (containerWidth < LAPTOP_REF_WIDTH_PX) {
    const t = Math.max(0, (containerWidth - 640) / (LAPTOP_REF_WIDTH_PX - 640));
    const tabletFloor = 0.94;
    factor *= tabletFloor + (1 - tabletFloor) * t;
  }

  return factor;
}

/** Default user zoom for the strand canvas — responsive, not a fixed percentage. */
export function computeDefaultStrandZoom(input: {
  twinning: boolean;
  containerWidth: number;
  containerHeight: number;
  isMobile: boolean;
  autoFitScale: number;
}): number {
  void input.twinning;
  const factor = viewportStrandZoomFactor(
    input.containerWidth,
    input.containerHeight,
    input.isMobile,
  );
  const targetEffective = STRAND_EFFECTIVE_ZOOM_TARGET * factor;
  const fit = Math.max(input.autoFitScale, 0.01);
  return clampStrandZoom(targetEffective / fit);
}

export interface StrandAutoFitOptions {
  twinning?: boolean;
  /** Full preview viewport width (both strands). */
  viewportWidthPx?: number;
  gapPx?: number;
}

export interface StrandViewportMeasureInput {
  containerWidth: number;
  containerHeight: number;
  isMobile: boolean;
  twinning: boolean;
  libraryOpen: boolean;
}

/**
 * Per-strand layout canvas — identical for single and matching pair.
 * Twinning only affects viewport auto-fit (camera), never bead diameter.
 */
export function measureStrandCanvasSize(input: StrandViewportMeasureInput): number {
  const { containerWidth: w, containerHeight: h, isMobile, libraryOpen } = input;
  if (isMobile) {
    const side = Math.min(w - 4, h - 20);
    return Math.round(
      Math.max(240, Math.min(480, side * STRAND_VIEWPORT_FILL)),
    );
  }

  const sidebarOffset = libraryOpen ? 256 : 0;
  const availableW = w - sidebarOffset - 2;
  const maxByWidth = availableW;
  const maxByHeight = h - 2;
  const side = Math.min(maxByWidth, maxByHeight) * STRAND_VIEWPORT_FILL;

  return Math.round(Math.max(360, Math.min(920, side)));
}

export interface StrandContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Bounding box of ring + placed beads in layout coordinates. */
export function computeStrandContentBounds(
  slots: { x: number; y: number; width: number; height: number }[],
  radius: number,
  center: number,
): StrandContentBounds {
  let minX = center - radius;
  let maxX = center + radius;
  let minY = center - radius;
  let maxY = center + radius;

  for (const slot of slots) {
    const hw = slot.width / 2;
    const hh = slot.height / 2;
    minX = Math.min(minX, slot.x - hw);
    maxX = Math.max(maxX, slot.x + hw);
    minY = Math.min(minY, slot.y - hh);
    maxY = Math.max(maxY, slot.y + hh);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Shift bead centers and ring center together so the bracelet path stays on canvas center.
 * Uses the ring center (not the asymmetric bead bbox) so mixed sizes remain path-aligned.
 */
export function shiftStrandLayoutToCanvasCenter<
  T extends { x: number; y: number; shellLeft?: number; shellTop?: number },
>(params: {
  ringCenter: number;
  targetCenter: number;
  slots: T[];
}): { ringCenter: number; slots: T[] } {
  const { ringCenter, targetCenter, slots } = params;
  const shift = targetCenter - ringCenter;
  return {
    ringCenter: targetCenter,
    slots: slots.map((slot) => ({
      ...slot,
      x: slot.x + shift,
      y: slot.y + shift,
      ...(slot.shellLeft != null ? { shellLeft: slot.shellLeft + shift } : {}),
      ...(slot.shellTop != null ? { shellTop: slot.shellTop + shift } : {}),
    })),
  };
}

/** True when every slot center lies on the ring (within tolerance). */
export function slotCentersOnRing(
  slots: { x: number; y: number }[],
  ringCenterX: number,
  ringCenterY: number,
  radius: number,
  tolerancePx = 0.5,
): boolean {
  return slots.every((slot) => {
    const dist = Math.hypot(slot.x - ringCenterX, slot.y - ringCenterY);
    return Math.abs(dist - radius) <= tolerancePx;
  });
}

/** Square canvas side length that fully contains the strand bounds. */
export function squareCanvasSizeForBounds(
  bounds: StrandContentBounds,
  paddingPx: number,
): number {
  const w = bounds.maxX - bounds.minX + paddingPx * 2;
  const h = bounds.maxY - bounds.minY + paddingPx * 2;
  return Math.ceil(Math.max(w, h, 1));
}

/**
 * Fixed layout canvas size — always matches the viewport budget.
 * Bead-driven expansion is handled by internal strand scaling, not DOM size.
 */
export function computeLayoutCanvasSize(viewportBudgetPx: number): number {
  return viewportBudgetPx;
}

/** Uniform boost (≤ 1) to fit computed strand bounds inside a fixed canvas. */
export function computeStrandCanvasFitBoost(requiredCanvasPx: number, fixedCanvasPx: number): number {
  if (requiredCanvasPx <= 0 || fixedCanvasPx <= 0) return 1;
  return Math.min(1, fixedCanvasPx / requiredCanvasPx);
}

/** Scale factor to fit a layout canvas into the viewport budget (never upscales above 1). */
export function computeStrandAutoFitScale(
  viewportBudgetPx: number,
  layoutCanvasPx: number,
  options?: StrandAutoFitOptions,
): number {
  if (layoutCanvasPx <= 0 || viewportBudgetPx <= 0) return 1;
  const single = Math.min(1, viewportBudgetPx / layoutCanvasPx);
  if (!options?.twinning) return single;

  const gap = options.gapPx ?? TWIN_STRAND_PREVIEW_GAP_PX;
  const viewportWidth = options.viewportWidthPx ?? viewportBudgetPx * 2 + gap;
  const byWidth = Math.max(0, (viewportWidth - gap) / (2 * layoutCanvasPx));
  return Math.min(1, single, byWidth);
}

/**
 * Temporary twin-mode fit multiplier layered on top of user zoom.
 * Keeps `autoFitScale` (single-strand) stable so user zoom % matches rendered framing after exit.
 */
export function computeTwinPreviewScale(
  baseAutoFitScale: number,
  twinAutoFitScale: number,
): number {
  if (baseAutoFitScale <= 0) return 1;
  return twinAutoFitScale / baseAutoFitScale;
}

/** Layout-only fit scale (auto-fit × optional twin layout adjustment). */
export function computeLayoutFitScale(params: {
  autoFitScale: number;
  twinPreviewScale?: number;
}): number {
  const twin = params.twinPreviewScale ?? 1;
  return params.autoFitScale * twin;
}

/** Effective viewport scale — transform scale applied to the strand content layer. */
export function computeStrandViewScale(params: {
  autoFitScale: number;
  userZoom: number;
  twinPreviewScale?: number;
}): number {
  const twin = params.twinPreviewScale ?? 1;
  return params.autoFitScale * params.userZoom * twin;
}
