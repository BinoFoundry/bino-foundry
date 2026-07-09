/**
 * Single source of truth for bracelet viewport rendering.
 *
 * All on-screen scale and pan come exclusively from RenderCamera.
 * Internal strand layout (bead mm → layout px) uses a fixed canvas size and must
 * never substitute for display scaling.
 */

import {
  computeMatchingPairCameraZoom,
  MATCHING_PAIR_CHROME_HEIGHT_PX,
  MATCHING_PAIR_FIT_SAFETY_MARGIN,
  resolveMatchingPairLayout,
  type MatchingPairLayout,
} from "./strand-camera";

export const RENDER_ZOOM_MIN = 0.55;
export const RENDER_ZOOM_MAX = 3;

export interface RenderCameraViewport {
  widthPx: number;
  heightPx: number;
}

/** Immutable camera — the only display transform state. */
export interface RenderCamera {
  zoom: number;
  panX: number;
  panY: number;
  viewport: RenderCameraViewport;
  /** Viewport layout fit (1 in single mode; computed in matching pair). */
  fitScale: number;
  /** fitScale × zoom — the sole CSS scale multiplier. */
  renderScale: number;
  matchingPairLayout?: MatchingPairLayout;
}

export interface RenderCameraLayoutInput {
  viewportWidthPx: number;
  viewportHeightPx: number;
  layoutCanvasSizePx: number;
  twinning: boolean;
}

export function clampRenderZoom(value: number): number {
  return Math.max(RENDER_ZOOM_MIN, Math.min(RENDER_ZOOM_MAX, value));
}

export function syncRenderScale(camera: RenderCamera): RenderCamera {
  camera.renderScale = camera.fitScale * camera.zoom;
  return camera;
}

export function createRenderCamera(params: {
  zoom: number;
  panX?: number;
  panY?: number;
  viewport: RenderCameraViewport;
  fitScale?: number;
  matchingPairLayout?: MatchingPairLayout;
}): RenderCamera {
  const camera: RenderCamera = {
    zoom: clampRenderZoom(params.zoom),
    panX: params.panX ?? 0,
    panY: params.panY ?? 0,
    viewport: { ...params.viewport },
    fitScale: params.fitScale ?? 1,
    renderScale: 0,
    matchingPairLayout: params.matchingPairLayout,
  };
  return syncRenderScale(camera);
}

export function cloneRenderCamera(camera: RenderCamera): RenderCamera {
  return {
    zoom: camera.zoom,
    panX: camera.panX,
    panY: camera.panY,
    viewport: { ...camera.viewport },
    fitScale: camera.fitScale,
    renderScale: camera.renderScale,
    matchingPairLayout: camera.matchingPairLayout,
  };
}

export function renderCamerasEqual(a: RenderCamera, b: RenderCamera): boolean {
  return (
    a.zoom === b.zoom &&
    a.panX === b.panX &&
    a.panY === b.panY &&
    a.fitScale === b.fitScale &&
    a.renderScale === b.renderScale &&
    a.viewport.widthPx === b.viewport.widthPx &&
    a.viewport.heightPx === b.viewport.heightPx &&
    a.matchingPairLayout === b.matchingPairLayout
  );
}

/** CSS transform — the only display scale applied to strand content. */
export function renderCameraTransform(camera: RenderCamera): {
  transform: string;
  renderScale: number;
  panX: number;
  panY: number;
  displayZoom: number;
} {
  return {
    transform: `translate(${camera.panX}px, ${camera.panY}px) scale(${camera.renderScale})`,
    renderScale: camera.renderScale,
    panX: camera.panX,
    panY: camera.panY,
    displayZoom: camera.zoom,
  };
}

export function applyRenderCameraToElement(
  el: HTMLElement | null | undefined,
  camera: RenderCamera,
): void {
  if (!el) return;
  const { transform } = renderCameraTransform(camera);
  el.style.transform = transform;
}

export function computeSingleBraceletBoundingBox(
  layoutCanvasSizePx: number,
  chromeHeightPx = MATCHING_PAIR_CHROME_HEIGHT_PX,
): { widthPx: number; heightPx: number } {
  return {
    widthPx: layoutCanvasSizePx,
    heightPx: layoutCanvasSizePx + chromeHeightPx,
  };
}

/** Viewport-fit zoom for a single strand (fitScale stays 1; zoom carries the fit). */
export function computeSingleBraceletFitZoom(
  layout: RenderCameraLayoutInput,
  safetyMargin = MATCHING_PAIR_FIT_SAFETY_MARGIN,
): number {
  if (
    layout.viewportWidthPx <= 0 ||
    layout.viewportHeightPx <= 0 ||
    layout.layoutCanvasSizePx <= 0
  ) {
    return 1;
  }
  const bbox = computeSingleBraceletBoundingBox(layout.layoutCanvasSizePx);
  const budgetW = layout.viewportWidthPx * safetyMargin;
  const budgetH = layout.viewportHeightPx * safetyMargin;
  return clampRenderZoom(Math.min(budgetW / bbox.widthPx, budgetH / bbox.heightPx));
}

export interface InitializeBraceletCameraOptions {
  /** Keep user zoom + pan (viewport resize, matching-pair restore). */
  preserve?: Pick<RenderCamera, "zoom" | "panX" | "panY">;
}

/**
 * Canonical single-strand camera initialization.
 * Used on first load, design load, reset, and viewport resize (single mode).
 */
export function initializeBraceletCamera(
  layout: RenderCameraLayoutInput,
  options: InitializeBraceletCameraOptions = {},
): RenderCamera {
  const { preserve } = options;
  const zoom = preserve?.zoom ?? computeSingleBraceletFitZoom(layout);
  return createRenderCamera({
    zoom,
    panX: preserve?.panX ?? 0,
    panY: preserve?.panY ?? 0,
    viewport: { widthPx: layout.viewportWidthPx, heightPx: layout.viewportHeightPx },
    fitScale: 1,
  });
}

export function computeMatchingPairFitScale(
  layout: RenderCameraLayoutInput,
  pairLayout?: MatchingPairLayout,
): { fitScale: number; layout: MatchingPairLayout } {
  const resolved =
    pairLayout ??
    resolveMatchingPairLayout({
      viewportWidthPx: layout.viewportWidthPx,
      viewportHeightPx: layout.viewportHeightPx,
      layoutCanvasSizePx: layout.layoutCanvasSizePx,
      autoFitScale: 1,
    });

  const zoom = computeMatchingPairCameraZoom({
    viewportWidthPx: layout.viewportWidthPx,
    viewportHeightPx: layout.viewportHeightPx,
    layoutCanvasSizePx: layout.layoutCanvasSizePx,
    autoFitScale: 1,
    layout: resolved,
  });

  return { fitScale: zoom, layout: resolved };
}

export function createMatchingPairCamera(
  layout: RenderCameraLayoutInput,
  pairLayout?: MatchingPairLayout,
): RenderCamera {
  const { fitScale, layout: resolved } = computeMatchingPairFitScale(layout, pairLayout);
  return createRenderCamera({
    zoom: 1,
    panX: 0,
    panY: 0,
    viewport: { widthPx: layout.viewportWidthPx, heightPx: layout.viewportHeightPx },
    fitScale,
    matchingPairLayout: resolved,
  });
}

export function refitMatchingPairCamera(
  camera: RenderCamera,
  layout: RenderCameraLayoutInput,
): RenderCamera {
  const { fitScale, layout: resolved } = computeMatchingPairFitScale(layout, camera.matchingPairLayout);
  return syncRenderScale({
    ...camera,
    viewport: { widthPx: layout.viewportWidthPx, heightPx: layout.viewportHeightPx },
    fitScale,
    matchingPairLayout: resolved,
  });
}

export const RENDER_CAMERA_SAFETY_MARGIN = MATCHING_PAIR_FIT_SAFETY_MARGIN;

export interface RenderCameraDebugSnapshot {
  label: string;
  mode: "single" | "twin";
  zoom: number;
  panX: number;
  panY: number;
  fitScale: number;
  renderScale: number;
  viewportWidth: number;
  viewportHeight: number;
  transformMatrix: string;
  matchingPairLayout?: MatchingPairLayout;
}

export function isRenderCameraDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("strand-camera-debug") === "1";
  } catch {
    return false;
  }
}

export function logRenderCameraSnapshot(
  label: string,
  mode: "single" | "twin",
  camera: RenderCamera,
): RenderCameraDebugSnapshot {
  const { transform } = renderCameraTransform(camera);
  const snapshot: RenderCameraDebugSnapshot = {
    label,
    mode,
    zoom: camera.zoom,
    panX: camera.panX,
    panY: camera.panY,
    fitScale: camera.fitScale,
    renderScale: camera.renderScale,
    viewportWidth: camera.viewport.widthPx,
    viewportHeight: camera.viewport.heightPx,
    transformMatrix: transform,
    matchingPairLayout: camera.matchingPairLayout,
  };
  // eslint-disable-next-line no-console
  console.log(`[render-camera] ${label}`, snapshot);
  return snapshot;
}
