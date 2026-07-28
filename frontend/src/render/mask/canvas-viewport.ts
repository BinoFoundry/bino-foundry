/**
 * Shared canvas viewport math for manual polygon / transform editors.
 * Cursor-centered zoom with gentle increments and optional smooth animation.
 */

export const VIEWPORT_ZOOM_MIN = 0.25; // 25%
export const VIEWPORT_ZOOM_MAX = 8; // 800%
export const VIEWPORT_ZOOM_DEFAULT = 1; // 100%

export type ViewportState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function clampViewportZoom(scale: number): number {
  if (!Number.isFinite(scale)) return VIEWPORT_ZOOM_DEFAULT;
  return Math.min(VIEWPORT_ZOOM_MAX, Math.max(VIEWPORT_ZOOM_MIN, scale));
}

export function formatZoomPercent(scale: number): string {
  return `${Math.round(clampViewportZoom(scale) * 100)}%`;
}

/** Normalize wheel delta across mouse / trackpad / page modes; clamp bursts. */
export function normalizeWheelDelta(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  let delta = deltaY;
  if (deltaMode === 1) delta *= 16;
  if (deltaMode === 2) delta *= Math.max(1, viewportHeight);
  // Soft-cap so one flick can't leap multiple zoom stops.
  return Math.max(-80, Math.min(80, delta));
}

/**
 * Gentle exponential zoom factor (≈2–6% per typical wheel step).
 * Pinch / Ctrl+wheel uses a slightly higher but still controlled speed.
 */
export function zoomFactorFromWheel(delta: number, pinchZoom: boolean): number {
  const speed = pinchZoom ? 0.0028 : 0.0005;
  const factor = Math.exp(-delta * speed);
  return Math.max(0.96, Math.min(1.04, factor));
}

/** Keep the image point under the cursor fixed while changing scale. */
export function applyCursorCenteredZoom(
  state: ViewportState,
  nextScale: number,
  cursorScreenX: number,
  cursorScreenY: number,
): ViewportState {
  const scale = clampViewportZoom(nextScale);
  const imageX = (cursorScreenX - state.offsetX) / state.scale;
  const imageY = (cursorScreenY - state.offsetY) / state.scale;
  return {
    scale,
    offsetX: cursorScreenX - imageX * scale,
    offsetY: cursorScreenY - imageY * scale,
  };
}

/** 1:1 pan from a drag gesture (screen pixels → offset pixels). */
export function applyPanOffset(
  startOffset: { x: number; y: number },
  startClient: { x: number; y: number },
  clientX: number,
  clientY: number,
): { offsetX: number; offsetY: number } {
  return {
    offsetX: startOffset.x + (clientX - startClient.x),
    offsetY: startOffset.y + (clientY - startClient.y),
  };
}

/** Center the image at a given scale inside the CSS viewport. */
export function centerViewport(
  cssWidth: number,
  cssHeight: number,
  imgW: number,
  imgH: number,
  scale: number,
): ViewportState {
  const s = clampViewportZoom(scale);
  return {
    scale: s,
    offsetX: (cssWidth - imgW * s) / 2,
    offsetY: (cssHeight - imgH * s) / 2,
  };
}

/** Fit image comfortably in the viewport (with padding). */
export function fitViewportToScreen(
  cssWidth: number,
  cssHeight: number,
  imgW: number,
  imgH: number,
  padding = 32,
): ViewportState {
  const availW = Math.max(1, cssWidth - padding * 2);
  const availH = Math.max(1, cssHeight - padding * 2);
  const scale = clampViewportZoom(Math.min(availW / imgW, availH / imgH) * 0.96);
  return centerViewport(cssWidth, cssHeight, imgW, imgH, scale);
}

/** Reset to 100% zoom, image centered. */
export function resetViewportToDefault(
  cssWidth: number,
  cssHeight: number,
  imgW: number,
  imgH: number,
): ViewportState {
  return centerViewport(cssWidth, cssHeight, imgW, imgH, VIEWPORT_ZOOM_DEFAULT);
}

type SmoothZoomHost = {
  getState: () => ViewportState;
  setState: (next: ViewportState) => void;
  onFrame: () => void;
};

/**
 * Smoothly animates scale toward a wheel-driven target while locking the
 * image point under the cursor. Lightweight — one rAF loop, no allocations
 * in the hot pan path.
 */
export class SmoothCursorZoom {
  private targetScale = VIEWPORT_ZOOM_DEFAULT;
  private animating = false;
  private rafId = 0;
  private anchorScreenX = 0;
  private anchorScreenY = 0;
  private anchorImageX = 0;
  private anchorImageY = 0;

  constructor(private readonly host: SmoothZoomHost) {}

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.animating = false;
  }

  /** Cancel in-flight animation (e.g. before Fit / Reset). */
  cancel() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.animating = false;
    this.targetScale = this.host.getState().scale;
  }

  handleWheel(event: {
    clientX: number;
    clientY: number;
    deltaY: number;
    deltaMode: number;
    ctrlKey: boolean;
    metaKey: boolean;
  }, viewport: DOMRect) {
    const state = this.host.getState();
    const cx = event.clientX - viewport.left;
    const cy = event.clientY - viewport.top;
    this.anchorScreenX = cx;
    this.anchorScreenY = cy;
    this.anchorImageX = (cx - state.offsetX) / state.scale;
    this.anchorImageY = (cy - state.offsetY) / state.scale;

    const delta = normalizeWheelDelta(event.deltaY, event.deltaMode, viewport.height);
    const factor = zoomFactorFromWheel(delta, event.ctrlKey || event.metaKey);
    const base = this.animating ? this.targetScale : state.scale;
    this.targetScale = clampViewportZoom(base * factor);
    this.kick();
  }

  private kick() {
    if (this.animating) return;
    this.animating = true;
    const step = () => {
      const state = this.host.getState();
      const current = state.scale;
      const target = this.targetScale;
      const diff = target - current;
      // Snappy ease — settles quickly without jumping.
      let next = current + diff * 0.32;
      if (Math.abs(diff) < 0.0005 || Math.abs(diff) / Math.max(target, 0.01) < 0.0015) {
        next = target;
        this.animating = false;
      }
      this.host.setState({
        scale: next,
        offsetX: this.anchorScreenX - this.anchorImageX * next,
        offsetY: this.anchorScreenY - this.anchorImageY * next,
      });
      this.host.onFrame();
      if (this.animating) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.rafId = 0;
      }
    };
    this.rafId = requestAnimationFrame(step);
  }
}
