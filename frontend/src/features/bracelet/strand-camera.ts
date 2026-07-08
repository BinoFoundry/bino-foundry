/**
 * Single source of truth for the strand viewport camera.
 *
 * CameraState lives in logical world coordinates (layout units × user zoom factor).
 * Device pixels, DPR, and browser zoom only affect measurement inputs — never the stored camera.
 */

import { TWIN_STRAND_PREVIEW_GAP_PX } from "./strand-viewport";

/** Immutable camera — the only user-owned viewport state. */
export interface CameraState {
  /** User zoom multiplier relative to auto-fit (1 = 100%). */
  zoom: number;
  panX: number;
  panY: number;
}

export interface StrandLayoutContext {
  /** Single-strand auto-fit (≤ 1) — stable across twin toggle and resize-independent of twinning. */
  autoFitScale: number;
  layoutCanvasSize: number;
  twinning: boolean;
}

export interface StrandRenderTransform {
  /** CSS transform scale applied to [data-strand-viewport-content]. */
  viewScale: number;
  panX: number;
  panY: number;
  /** Zoom % shown in toolbar (= camera.zoom). */
  displayZoom: number;
}

/** Effective viewport scale — camera.zoom layered on auto-fit only (never twin shrink). */
export function computeStrandRenderTransform(
  camera: CameraState,
  layout: StrandLayoutContext,
): StrandRenderTransform {
  const viewScale = layout.autoFitScale * camera.zoom;
  return {
    viewScale,
    panX: camera.panX,
    panY: camera.panY,
    displayZoom: camera.zoom,
  };
}

export function cameraStateEquals(a: CameraState, b: CameraState): boolean {
  return a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY;
}

export interface CameraDebugSnapshot {
  label: string;
  timestamp: number;
  camera: CameraState;
  autoFitScale: number;
  layoutCanvasSize: number;
  twinning: boolean;
  viewportWidth: number;
  viewportHeight: number;
  containerWidth: number;
  containerHeight: number;
  devicePixelRatio: number;
  viewScale: number;
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
    camera: CameraState;
    layout: StrandLayoutContext;
    viewportWidth: number;
    viewportHeight: number;
    containerWidth: number;
    containerHeight: number;
    contentWidth?: number;
    contentHeight?: number;
  },
): CameraDebugSnapshot {
  const transform = computeStrandRenderTransform(params.camera, params.layout);
  const snapshot: CameraDebugSnapshot = {
    label,
    timestamp: performance.now(),
    camera: { ...params.camera },
    autoFitScale: params.layout.autoFitScale,
    layoutCanvasSize: params.layout.layoutCanvasSize,
    twinning: params.layout.twinning,
    viewportWidth: params.viewportWidth,
    viewportHeight: params.viewportHeight,
    containerWidth: params.containerWidth,
    containerHeight: params.containerHeight,
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    viewScale: transform.viewScale,
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
  chromeHeightPx = 52,
): { width: number; height: number } {
  const viewScale = layout.autoFitScale * camera.zoom;
  const scaled = layout.layoutCanvasSize * viewScale;
  return {
    width: layout.twinning ? scaled * 2 + TWIN_STRAND_PREVIEW_GAP_PX : scaled,
    height: scaled + chromeHeightPx,
  };
}
