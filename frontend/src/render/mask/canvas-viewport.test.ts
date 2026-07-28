import { describe, expect, it } from "vitest";

import {
  VIEWPORT_ZOOM_MAX,
  VIEWPORT_ZOOM_MIN,
  applyCursorCenteredZoom,
  applyPanOffset,
  clampViewportZoom,
  fitViewportToScreen,
  formatZoomPercent,
  normalizeWheelDelta,
  resetViewportToDefault,
  zoomFactorFromWheel,
} from "./canvas-viewport";

describe("canvas-viewport", () => {
  it("clamps zoom to 25%–800%", () => {
    expect(clampViewportZoom(0.01)).toBe(VIEWPORT_ZOOM_MIN);
    expect(clampViewportZoom(99)).toBe(VIEWPORT_ZOOM_MAX);
    expect(clampViewportZoom(1)).toBe(1);
  });

  it("formats live zoom percentages", () => {
    expect(formatZoomPercent(1)).toBe("100%");
    expect(formatZoomPercent(1.5)).toBe("150%");
    expect(formatZoomPercent(2.5)).toBe("250%");
  });

  it("keeps the image point under the cursor when zooming", () => {
    const before = { scale: 1, offsetX: 10, offsetY: 20 };
    const cursor = { x: 110, y: 220 };
    const imageX = (cursor.x - before.offsetX) / before.scale;
    const imageY = (cursor.y - before.offsetY) / before.scale;
    const after = applyCursorCenteredZoom(before, 2, cursor.x, cursor.y);
    expect((cursor.x - after.offsetX) / after.scale).toBeCloseTo(imageX, 6);
    expect((cursor.y - after.offsetY) / after.scale).toBeCloseTo(imageY, 6);
  });

  it("pans 1:1 with the mouse", () => {
    const next = applyPanOffset({ x: 5, y: 8 }, { x: 100, y: 200 }, 130, 240);
    expect(next).toEqual({ offsetX: 35, offsetY: 48 });
  });

  it("uses gentle per-event zoom factors", () => {
    const factor = zoomFactorFromWheel(100, false);
    expect(factor).toBeGreaterThanOrEqual(0.96);
    expect(factor).toBeLessThanOrEqual(1.04);
    expect(factor).toBeLessThan(1);
  });

  it("soft-caps wheel bursts", () => {
    expect(normalizeWheelDelta(10_000, 0, 500)).toBe(80);
    expect(normalizeWheelDelta(-10_000, 0, 500)).toBe(-80);
  });

  it("resets to 100% centered", () => {
    const v = resetViewportToDefault(400, 300, 200, 100);
    expect(v.scale).toBe(1);
    expect(v.offsetX).toBe(100);
    expect(v.offsetY).toBe(100);
  });

  it("fits to screen within zoom limits", () => {
    const v = fitViewportToScreen(400, 300, 800, 600);
    expect(v.scale).toBeGreaterThanOrEqual(VIEWPORT_ZOOM_MIN);
    expect(v.scale).toBeLessThanOrEqual(VIEWPORT_ZOOM_MAX);
    expect(v.scale).toBeLessThan(1);
  });
});
