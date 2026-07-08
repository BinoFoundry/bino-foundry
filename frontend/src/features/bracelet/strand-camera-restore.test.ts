import { describe, expect, it } from "vitest";

import {
  cameraStateEquals,
  computeStrandRenderTransform,
  type CameraState,
} from "./strand-camera";
import { computeStrandViewScale } from "./strand-viewport";

const LAYOUT = {
  autoFitScale: 1,
  layoutCanvasSize: 500,
  twinning: false,
};

const TWIN_LAYOUT = { ...LAYOUT, twinning: true };

/** Simulates the camera engine: twin toggle never mutates CameraState. */
function simulateTwinToggleCycle(camera: CameraState, cycles = 100): CameraState {
  let current = { ...camera };
  for (let i = 0; i < cycles; i += 1) {
    const beforeSingle = computeStrandRenderTransform(current, LAYOUT);
    const duringTwin = computeStrandRenderTransform(current, TWIN_LAYOUT);
    expect(duringTwin.viewScale).toBe(beforeSingle.viewScale);
    expect(duringTwin.displayZoom).toBe(beforeSingle.displayZoom);
    current = { ...current };
    const afterTwin = computeStrandRenderTransform(current, LAYOUT);
    expect(afterTwin.viewScale).toBe(beforeSingle.viewScale);
    expect(cameraStateEquals(current, camera)).toBe(true);
  }
  return current;
}

describe("strand camera engine", () => {
  it("displayZoom always equals camera.zoom", () => {
    const transform = computeStrandRenderTransform({ zoom: 1.5, panX: 0, panY: 0 }, LAYOUT);
    expect(transform.displayZoom).toBe(1.5);
    expect(transform.viewScale).toBe(1.5);
  });

  it("twin toggle does not change viewScale when camera is unchanged", () => {
    const camera: CameraState = { zoom: 1.56, panX: 12, panY: -8 };
    const single = computeStrandRenderTransform(camera, LAYOUT);
    const twin = computeStrandRenderTransform(camera, TWIN_LAYOUT);
    expect(twin.viewScale).toBe(single.viewScale);
    expect(twin.displayZoom).toBe(single.displayZoom);
    expect(twin.panX).toBe(camera.panX);
    expect(twin.panY).toBe(camera.panY);
  });

  it("has zero drift after 100 twin toggle cycles", () => {
    const camera: CameraState = { zoom: 1.56, panX: 20, panY: -15 };
    const result = simulateTwinToggleCycle(camera, 100);
    expect(cameraStateEquals(result, camera)).toBe(true);
    expect(computeStrandViewScale({ autoFitScale: 1, userZoom: result.zoom })).toBeCloseTo(1.56, 10);
  });

  it("auto-fit changes do not mutate camera — only viewScale output", () => {
    const camera: CameraState = { zoom: 1.5, panX: 0, panY: 0 };
    const loose = computeStrandRenderTransform(camera, { ...LAYOUT, autoFitScale: 0.8 });
    const tight = computeStrandRenderTransform(camera, { ...LAYOUT, autoFitScale: 1 });
    expect(loose.displayZoom).toBe(1.5);
    expect(tight.displayZoom).toBe(1.5);
    expect(loose.viewScale).toBeCloseTo(1.2, 5);
    expect(tight.viewScale).toBeCloseTo(1.5, 5);
  });
});
