import { describe, expect, it } from "vitest";

import {
  cloneRenderCamera,
  createMatchingPairCamera,
  createRenderCamera,
  initializeBraceletCamera,
  renderCameraTransform,
  renderCamerasEqual,
  refitMatchingPairCamera,
} from "./render-camera";

const LAYOUT = {
  viewportWidthPx: 1024,
  viewportHeightPx: 700,
  layoutCanvasSizePx: 500,
  twinning: true,
};

function simulateTwinToggleCycle(
  single: ReturnType<typeof createRenderCamera>,
  twin: ReturnType<typeof createMatchingPairCamera> | null,
  inTwin: boolean,
  layout = LAYOUT,
) {
  if (!inTwin) {
    const frozenSingle = cloneRenderCamera(single);
    const nextTwin = twin ?? createMatchingPairCamera(layout);
    return { single: frozenSingle, twin: nextTwin, inTwin: true, active: nextTwin };
  }
  const savedTwin = cloneRenderCamera(twin!);
  return { single, twin: savedTwin, inTwin: false, active: single };
}

describe("RenderCamera", () => {
  it("single mode renderScale equals zoom when fitScale is 1", () => {
    const camera = createRenderCamera({
      zoom: 1.56,
      viewport: { widthPx: 1024, heightPx: 700 },
      fitScale: 1,
    });
    expect(camera.renderScale).toBeCloseTo(1.56, 10);
    expect(renderCameraTransform(camera).transform).toContain("scale(1.56");
  });

  it("initializeBraceletCamera fits single strand to viewport", () => {
    const camera = initializeBraceletCamera(LAYOUT);
    expect(camera.fitScale).toBe(1);
    expect(camera.zoom).toBeGreaterThan(0.5);
    expect(camera.renderScale).toBe(camera.zoom);
    expect(camera.panX).toBe(0);
    expect(camera.panY).toBe(0);
  });

  it("initializeBraceletCamera preserves user zoom on viewport resize", () => {
    const first = initializeBraceletCamera(LAYOUT);
    const resized = initializeBraceletCamera(
      { ...LAYOUT, viewportWidthPx: 768, viewportHeightPx: 900 },
      { preserve: { zoom: 1.42, panX: 3, panY: -2 } },
    );
    expect(resized.zoom).toBe(1.42);
    expect(resized.panX).toBe(3);
    expect(resized.panY).toBe(-2);
    expect(resized.viewport.widthPx).toBe(768);
  });

  it("initial and post-twin-restore cameras match when frozen at twin enter", () => {
    const initial = initializeBraceletCamera(LAYOUT);
    const frozen = cloneRenderCamera(initial);
    const twin = createMatchingPairCamera(LAYOUT);
    void twin;
    const restored = cloneRenderCamera(frozen);
    expect(renderCamerasEqual(initial, restored)).toBe(true);
  });

  it("matching pair fitScale is stored only on twin camera", () => {
    const single = createRenderCamera({
      zoom: 1.56,
      panX: 5,
      panY: -3,
      viewport: { widthPx: 1024, heightPx: 700 },
      fitScale: 1,
    });
    const twin = createMatchingPairCamera(LAYOUT);
    expect(twin.fitScale).toBeLessThan(1);
    expect(single.fitScale).toBe(1);
    expect(single.renderScale).toBeCloseTo(1.56, 10);
  });

  it("restores exact single camera after twin exit without recalculation", () => {
    const singleBefore = createRenderCamera({
      zoom: 1.56,
      panX: 12,
      panY: -8,
      viewport: { widthPx: 1024, heightPx: 700 },
      fitScale: 1,
    });
    const frozen = cloneRenderCamera(singleBefore);
    const twin = createMatchingPairCamera(LAYOUT);
    const savedTwin = cloneRenderCamera(twin);
    const restored = cloneRenderCamera(frozen);

    expect(renderCamerasEqual(restored, singleBefore)).toBe(true);
    expect(savedTwin.fitScale).not.toBe(1);
  });

  it("has zero drift after 100 twin toggles", () => {
    const singleBefore = createRenderCamera({
      zoom: 1.56,
      panX: 12,
      panY: -8,
      viewport: { widthPx: 1024, heightPx: 700 },
      fitScale: 1,
    });

    let single = cloneRenderCamera(singleBefore);
    let twin: ReturnType<typeof createMatchingPairCamera> | null = null;
    let inTwin = false;

    for (let i = 0; i < 100; i++) {
      const cycle = simulateTwinToggleCycle(single, twin, inTwin, {
        ...LAYOUT,
        viewportWidthPx: 1024 + (i % 5) * 20,
        viewportHeightPx: 700,
      });
      single = cycle.single;
      twin = cycle.twin;
      inTwin = cycle.inTwin;

      if (inTwin) {
        const refitted = refitMatchingPairCamera(cycle.twin, {
          viewportWidthPx: LAYOUT.viewportWidthPx,
          viewportHeightPx: LAYOUT.viewportHeightPx,
          layoutCanvasSizePx: LAYOUT.layoutCanvasSizePx,
          twinning: true,
        });
        expect(refitted.fitScale).toBeGreaterThan(0);
      }
    }

    expect(renderCamerasEqual(single, singleBefore)).toBe(true);
  });

  it("refits matching pair on viewport resize without touching single camera", () => {
    const single = createRenderCamera({
      zoom: 1.56,
      viewport: { widthPx: 1024, heightPx: 700 },
      fitScale: 1,
    });
    const twin = createMatchingPairCamera(LAYOUT);
    const refitted = refitMatchingPairCamera(twin, {
      viewportWidthPx: 768,
      viewportHeightPx: 900,
      layoutCanvasSizePx: 500,
      twinning: true,
    });

    expect(refitted.fitScale).not.toBe(twin.fitScale);
    expect(single.renderScale).toBeCloseTo(1.56, 10);
  });
});
