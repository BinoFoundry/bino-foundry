/**
 * Single source of truth for the strand viewport camera.
 *
 * CameraState lives in logical world coordinates (layout units × user zoom factor).
 * Device pixels, DPR, and browser zoom only affect measurement inputs — never the stored camera.
 */

import { STRAND_ZOOM_MAX, STRAND_ZOOM_MIN, TWIN_STRAND_PREVIEW_GAP_PX } from "./strand-viewport";

/** Comfortable padding around matching pair (8% inset on each axis). */
export const MATCHING_PAIR_FIT_SAFETY_MARGIN = 0.92;

/** Default vertical chrome above strand canvases (labels, controls). */
export const MATCHING_PAIR_CHROME_HEIGHT_PX = 52;

export type MatchingPairLayout = "side-by-side" | "stacked";

export interface MatchingPairFitInput {
  /** Visible viewport width in CSS pixels. */
  viewportWidthPx: number;
  /** Visible viewport height in CSS pixels. */
  viewportHeightPx: number;
  /** Unscaled side length of each strand layout canvas. */
  layoutCanvasSizePx: number;
  /** Single-strand auto-fit (≤ 1). */
  autoFitScale: number;
  gapPx?: number;
  chromeHeightPx?: number;
  /** Multiplier applied to viewport budget (e.g. 0.92 = 8% padding). */
  safetyMargin?: number;
  layout?: MatchingPairLayout;
}

export interface MatchingPairBoundingBox {
  widthPx: number;
  heightPx: number;
  layout: MatchingPairLayout;
}

function clampCameraZoom(value: number): number {
  return Math.max(STRAND_ZOOM_MIN, Math.min(STRAND_ZOOM_MAX, value));
}

/** Unscaled layout bounding box for two strand canvases in the chosen orientation. */
export function computeMatchingPairBoundingBox(
  layoutCanvasSizePx: number,
  layout: MatchingPairLayout = "side-by-side",
  gapPx = TWIN_STRAND_PREVIEW_GAP_PX,
  chromeHeightPx = MATCHING_PAIR_CHROME_HEIGHT_PX,
): MatchingPairBoundingBox {
  if (layout === "stacked") {
    return {
      layout,
      widthPx: layoutCanvasSizePx,
      heightPx: layoutCanvasSizePx * 2 + gapPx + chromeHeightPx,
    };
  }
  return {
    layout,
    widthPx: layoutCanvasSizePx * 2 + gapPx,
    heightPx: layoutCanvasSizePx + chromeHeightPx,
  };
}

function fitViewScaleForLayout(input: MatchingPairFitInput, layout: MatchingPairLayout): number {
  const {
    viewportWidthPx,
    viewportHeightPx,
    layoutCanvasSizePx,
    gapPx = TWIN_STRAND_PREVIEW_GAP_PX,
    chromeHeightPx = MATCHING_PAIR_CHROME_HEIGHT_PX,
    safetyMargin = MATCHING_PAIR_FIT_SAFETY_MARGIN,
  } = input;

  const bbox = computeMatchingPairBoundingBox(
    layoutCanvasSizePx,
    layout,
    gapPx,
    chromeHeightPx,
  );
  const budgetW = viewportWidthPx * safetyMargin;
  const budgetH = viewportHeightPx * safetyMargin;
  return Math.min(budgetW / bbox.widthPx, budgetH / bbox.heightPx);
}

/**
 * Picks side-by-side vs stacked based on which orientation yields a larger fit.
 * Continuous — no viewport breakpoints.
 */
export function resolveMatchingPairLayout(input: MatchingPairFitInput): MatchingPairLayout {
  const sideBySide = fitViewScaleForLayout(input, "side-by-side");
  const stacked = fitViewScaleForLayout(input, "stacked");
  return stacked > sideBySide ? "stacked" : "side-by-side";
}

/**
 * Viewport-fit zoom for matching pair mode — independent of single-strand user zoom.
 * Smoothly interpolates across all viewport sizes (reference: ~90% @ 1024px, ~110% @ 1200px).
 */
export function computeMatchingPairCameraZoom(input: MatchingPairFitInput): number {
  const { autoFitScale } = input;
  if (
    input.viewportWidthPx <= 0 ||
    input.viewportHeightPx <= 0 ||
    input.layoutCanvasSizePx <= 0 ||
    autoFitScale <= 0
  ) {
    return 1;
  }

  const layout = input.layout ?? resolveMatchingPairLayout(input);
  const fitViewScale = fitViewScaleForLayout(input, layout);
  return clampCameraZoom(fitViewScale / autoFitScale);
}

/** @deprecated Use computeMatchingPairCameraZoom — kept for transitional tests. */
export function computeMatchingPairRenderFitScale(
  input: MatchingPairFitInput & { userZoom: number },
): number {
  const { userZoom, autoFitScale } = input;
  if (userZoom <= 0 || autoFitScale <= 0) return 1;
  const twinZoom = computeMatchingPairCameraZoom(input);
  return Math.min(1, twinZoom / userZoom);
}

/** Verify scaled matching pair fits inside viewport budget (for tests). */
export function matchingPairFitsViewport(params: {
  viewportWidthPx: number;
  viewportHeightPx: number;
  layoutCanvasSizePx: number;
  viewScale: number;
  safetyMargin?: number;
  gapPx?: number;
  chromeHeightPx?: number;
  layout?: MatchingPairLayout;
}): boolean {
  const margin = params.safetyMargin ?? MATCHING_PAIR_FIT_SAFETY_MARGIN;
  const layout = params.layout ?? resolveMatchingPairLayout({
    viewportWidthPx: params.viewportWidthPx,
    viewportHeightPx: params.viewportHeightPx,
    layoutCanvasSizePx: params.layoutCanvasSizePx,
    autoFitScale: 1,
    gapPx: params.gapPx,
    chromeHeightPx: params.chromeHeightPx,
    safetyMargin: margin,
  });
  const bbox = computeMatchingPairBoundingBox(
    params.layoutCanvasSizePx,
    layout,
    params.gapPx,
    params.chromeHeightPx,
  );
  const budgetW = params.viewportWidthPx * margin;
  const budgetH = params.viewportHeightPx * margin;
  return bbox.widthPx * params.viewScale <= budgetW + 0.5 &&
    bbox.heightPx * params.viewScale <= budgetH + 0.5;
}

/** Immutable camera — user-owned viewport state (zoom + pan). */
export interface CameraState {
  /** User zoom multiplier relative to auto-fit (1 = 100%). */
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Complete per-mode camera — never shared between Single and Matching Pair.
 * `autoFitScale` and `viewScale` are frozen when the snapshot is saved.
 */
export interface StrandCameraSnapshot {
  zoom: number;
  panX: number;
  panY: number;
  /** Auto-fit multiplier active when this snapshot was captured. */
  autoFitScale: number;
  /** Canonical CSS scale (= autoFitScale × zoom) at capture time. */
  viewScale: number;
  matchingPairLayout?: MatchingPairLayout;
}

export function viewScaleFromSnapshot(snapshot: StrandCameraSnapshot): number {
  return snapshot.autoFitScale * snapshot.zoom;
}

export function captureStrandCameraSnapshot(
  camera: CameraState,
  autoFitScale: number,
  matchingPairLayout?: MatchingPairLayout,
): StrandCameraSnapshot {
  const viewScale = autoFitScale * camera.zoom;
  return {
    zoom: camera.zoom,
    panX: camera.panX,
    panY: camera.panY,
    autoFitScale,
    viewScale,
    matchingPairLayout,
  };
}

export function cloneStrandCameraSnapshot(snapshot: StrandCameraSnapshot): StrandCameraSnapshot {
  return { ...snapshot };
}

export function strandCameraSnapshotsEqual(
  a: StrandCameraSnapshot,
  b: StrandCameraSnapshot,
): boolean {
  return (
    a.zoom === b.zoom &&
    a.panX === b.panX &&
    a.panY === b.panY &&
    a.autoFitScale === b.autoFitScale &&
    a.viewScale === b.viewScale &&
    a.matchingPairLayout === b.matchingPairLayout
  );
}

export function snapshotToCameraState(snapshot: StrandCameraSnapshot): CameraState {
  return { zoom: snapshot.zoom, panX: snapshot.panX, panY: snapshot.panY };
}

export interface StrandLayoutContext {
  /** Single-strand auto-fit (≤ 1) — stable across twin toggle and resize-independent of twinning. */
  autoFitScale: number;
  layoutCanvasSize: number;
  twinning: boolean;
  matchingPairLayout?: MatchingPairLayout;
}

export interface StrandRenderTransform {
  /** CSS transform scale applied to [data-strand-viewport-content]. */
  viewScale: number;
  panX: number;
  panY: number;
  /** Zoom % shown in toolbar (= camera.zoom). */
  displayZoom: number;
}

/** Effective viewport scale — uses snapshot fit scale when provided (mode restore). */
export function computeStrandRenderTransform(
  camera: CameraState,
  layout: StrandLayoutContext,
  snapshotAutoFitScale?: number,
): StrandRenderTransform {
  const fitScale = snapshotAutoFitScale ?? layout.autoFitScale;
  const viewScale = fitScale * camera.zoom;
  return {
    viewScale,
    panX: camera.panX,
    panY: camera.panY,
    displayZoom: camera.zoom,
  };
}

export function computeStrandRenderTransformFromSnapshot(
  snapshot: StrandCameraSnapshot,
): StrandRenderTransform {
  return {
    viewScale: viewScaleFromSnapshot(snapshot),
    panX: snapshot.panX,
    panY: snapshot.panY,
    displayZoom: snapshot.zoom,
  };
}

export function cameraStateEquals(a: CameraState, b: CameraState): boolean {
  return a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY;
}

export function cloneCameraState(camera: CameraState): CameraState {
  return { zoom: camera.zoom, panX: camera.panX, panY: camera.panY };
}

export interface CameraDebugSnapshot {
  label: string;
  timestamp: number;
  mode: "single" | "twin";
  camera: CameraState;
  baseScale: number;
  fitScale: number;
  zoom: number;
  panX: number;
  panY: number;
  transformMatrix: string;
  finalRenderScale: number;
  autoFitScale: number;
  layoutCanvasSize: number;
  twinning: boolean;
  matchingPairLayout?: MatchingPairLayout;
  viewportWidth: number;
  viewportHeight: number;
  containerWidth: number;
  containerHeight: number;
  devicePixelRatio: number;
  displayZoom: number;
  contentWidth: number;
  contentHeight: number;
}

export function isStrandCameraDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("strand-camera-debug") === "1";
  } catch {
    return false;
  }
}

export function logCameraDebugSnapshot(
  label: string,
  params: {
    snapshot: StrandCameraSnapshot;
    layout: StrandLayoutContext;
    viewportWidth: number;
    viewportHeight: number;
    containerWidth: number;
    containerHeight: number;
    contentWidth?: number;
    contentHeight?: number;
  },
): CameraDebugSnapshot {
  const transform = computeStrandRenderTransformFromSnapshot(params.snapshot);
  const transformMatrix = `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.viewScale})`;
  const snapshot: CameraDebugSnapshot = {
    label,
    timestamp: performance.now(),
    mode: params.layout.twinning ? "twin" : "single",
    camera: snapshotToCameraState(params.snapshot),
    baseScale: params.layout.layoutCanvasSize,
    fitScale: params.snapshot.autoFitScale,
    zoom: params.snapshot.zoom,
    panX: params.snapshot.panX,
    panY: params.snapshot.panY,
    transformMatrix,
    finalRenderScale: transform.viewScale,
    autoFitScale: params.snapshot.autoFitScale,
    layoutCanvasSize: params.layout.layoutCanvasSize,
    twinning: params.layout.twinning,
    matchingPairLayout: params.snapshot.matchingPairLayout,
    viewportWidth: params.viewportWidth,
    viewportHeight: params.viewportHeight,
    containerWidth: params.containerWidth,
    containerHeight: params.containerHeight,
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    displayZoom: transform.displayZoom,
    contentWidth: params.contentWidth ?? 0,
    contentHeight: params.contentHeight ?? 0,
  };
  // eslint-disable-next-line no-console
  console.log(`[strand-camera] ${label}`, snapshot);
  return snapshot;
}

/** Expected content extent for pan bounds (layout px, pre-transform). */
export function expectedStrandContentExtent(
  layout: StrandLayoutContext,
  camera: CameraState,
  chromeHeightPx = MATCHING_PAIR_CHROME_HEIGHT_PX,
  snapshotAutoFitScale?: number,
): { width: number; height: number } {
  const fitScale = snapshotAutoFitScale ?? layout.autoFitScale;
  const viewScale = fitScale * camera.zoom;
  const scaled = layout.layoutCanvasSize * viewScale;
  if (!layout.twinning) {
    return { width: scaled, height: scaled + chromeHeightPx };
  }

  const pairLayout = layout.matchingPairLayout ?? "side-by-side";
  if (pairLayout === "stacked") {
    return {
      width: scaled,
      height: scaled * 2 + TWIN_STRAND_PREVIEW_GAP_PX + chromeHeightPx,
    };
  }
  return {
    width: scaled * 2 + TWIN_STRAND_PREVIEW_GAP_PX,
    height: scaled + chromeHeightPx,
  };
}
