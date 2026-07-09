import { describe, expect, it } from "vitest";

import {
  captureStrandCameraSnapshot,
  cloneStrandCameraSnapshot,
  computeMatchingPairBoundingBox,
  computeMatchingPairCameraZoom,
  computeStrandRenderTransform,
  computeStrandRenderTransformFromSnapshot,
  matchingPairFitsViewport,
  strandCameraSnapshotsEqual,
} from "./strand-camera";

const SINGLE_LAYOUT = {
  autoFitScale: 1,
  layoutCanvasSize: 500,
  twinning: false,
};

describe("computeMatchingPairCameraZoom", () => {
  const canvas = 500;
  const autoFit = 1;
  const height = 700;

  it("interpolates smoothly near 90% at 1024px width", () => {
    const zoom = computeMatchingPairCameraZoom({
      viewportWidthPx: 1024,
      viewportHeightPx: height,
      layoutCanvasSizePx: canvas,
      autoFitScale: autoFit,
    });
    expect(zoom).toBeGreaterThan(0.85);
    expect(zoom).toBeLessThan(0.96);
    expect(matchingPairFitsViewport({
      viewportWidthPx: 1024,
      viewportHeightPx: height,
      layoutCanvasSizePx: canvas,
      viewScale: autoFit * zoom,
    })).toBe(true);
  });

  it("interpolates smoothly near 103% at 1140px width", () => {
    const zoom = computeMatchingPairCameraZoom({
      viewportWidthPx: 1140,
      viewportHeightPx: height,
      layoutCanvasSizePx: canvas,
      autoFitScale: autoFit,
    });
    expect(zoom).toBeGreaterThan(0.98);
    expect(zoom).toBeLessThan(1.08);
  });

  it("interpolates smoothly near 110% at 1200px width", () => {
    const zoom = computeMatchingPairCameraZoom({
      viewportWidthPx: 1200,
      viewportHeightPx: height,
      layoutCanvasSizePx: canvas,
      autoFitScale: autoFit,
    });
    expect(zoom).toBeGreaterThan(1.04);
    expect(zoom).toBeLessThan(1.16);
  });

  it("fits MacBook and tablet viewports without clipping", () => {
    for (const [w, h] of [[780, 420], [920, 480], [768, 900]] as const) {
      const zoom = computeMatchingPairCameraZoom({
        viewportWidthPx: w,
        viewportHeightPx: h,
        layoutCanvasSizePx: canvas,
        autoFitScale: autoFit,
      });
      expect(matchingPairFitsViewport({
        viewportWidthPx: w,
        viewportHeightPx: h,
        layoutCanvasSizePx: canvas,
        viewScale: autoFit * zoom,
      })).toBe(true);
    }
  });
});

describe("strand camera twin mode", () => {
  it("twin camera zoom is independent of single-strand user zoom", () => {
    const singleSnapshot = captureStrandCameraSnapshot(
      { zoom: 1.56, panX: 0, panY: 0 },
      1,
    );
    const single = computeStrandRenderTransformFromSnapshot(singleSnapshot);

    const twinZoom = computeMatchingPairCameraZoom({
      viewportWidthPx: 1024,
      viewportHeightPx: 700,
      layoutCanvasSizePx: 500,
      autoFitScale: 1,
    });
    const twinSnapshot = captureStrandCameraSnapshot(
      { zoom: twinZoom, panX: 0, panY: 0 },
      1,
      "side-by-side",
    );
    const twin = computeStrandRenderTransformFromSnapshot(twinSnapshot);

    expect(twin.displayZoom).toBeLessThan(single.displayZoom);
    expect(twin.viewScale).toBeLessThan(single.viewScale);
  });

  it("restores exact render scale when layout autoFitScale drifts during twin", () => {
    const singleBefore = captureStrandCameraSnapshot(
      { zoom: 1.56, panX: 5, panY: -3 },
      1,
    );
    const beforeTransform = computeStrandRenderTransformFromSnapshot(singleBefore);

    const twinZoom = computeMatchingPairCameraZoom({
      viewportWidthPx: 800,
      viewportHeightPx: 450,
      layoutCanvasSizePx: 500,
      autoFitScale: 1.08,
    });
    captureStrandCameraSnapshot({ zoom: twinZoom, panX: 0, panY: 0 }, 1.08, "side-by-side");

    const singleAfter = cloneStrandCameraSnapshot(singleBefore);
    const afterTransform = computeStrandRenderTransformFromSnapshot(singleAfter);

    expect(afterTransform.viewScale).toBe(beforeTransform.viewScale);
    expect(afterTransform.panX).toBe(beforeTransform.panX);
    expect(afterTransform.panY).toBe(beforeTransform.panY);
    expect(afterTransform.displayZoom).toBe(1.56);
    expect(singleAfter.autoFitScale).toBe(1);
    expect(singleAfter.viewScale).toBe(beforeTransform.viewScale);
  });

  it("has zero drift after 100 twin toggles with autoFit drift", () => {
    const singleBefore = captureStrandCameraSnapshot(
      { zoom: 1.56, panX: 12, panY: -8 },
      1,
    );
    let singleSnapshot = cloneStrandCameraSnapshot(singleBefore);
    let twinSnapshot: ReturnType<typeof captureStrandCameraSnapshot> | null = null;
    let inTwin = false;
    let layoutAutoFit = 1;

    const beforeTransform = computeStrandRenderTransformFromSnapshot(singleBefore);

    for (let i = 0; i < 100; i++) {
      if (!inTwin) {
        singleSnapshot = cloneStrandCameraSnapshot({
          zoom: singleBefore.zoom,
          panX: singleBefore.panX,
          panY: singleBefore.panY,
          autoFitScale: singleBefore.autoFitScale,
          viewScale: singleBefore.viewScale,
        });
        layoutAutoFit = 1.05 + (i % 3) * 0.02;
        const twinZoom = computeMatchingPairCameraZoom({
          viewportWidthPx: 1024,
          viewportHeightPx: 700,
          layoutCanvasSizePx: 500,
          autoFitScale: layoutAutoFit,
        });
        twinSnapshot = twinSnapshot ?? captureStrandCameraSnapshot(
          { zoom: twinZoom, panX: 0, panY: 0 },
          layoutAutoFit,
          "side-by-side",
        );
        inTwin = true;
      } else {
        twinSnapshot = captureStrandCameraSnapshot(
          { zoom: twinSnapshot!.zoom, panX: 0, panY: 0 },
          layoutAutoFit,
          "side-by-side",
        );
        inTwin = false;
      }
    }

    const afterTransform = computeStrandRenderTransformFromSnapshot(singleSnapshot);
    expect(afterTransform.viewScale).toBe(beforeTransform.viewScale);
    expect(afterTransform.panX).toBe(beforeTransform.panX);
    expect(afterTransform.panY).toBe(beforeTransform.panY);
    expect(strandCameraSnapshotsEqual(singleSnapshot, singleBefore)).toBe(true);
  });

  it("legacy computeStrandRenderTransform uses snapshot autoFit when provided", () => {
    const transform = computeStrandRenderTransform(
      { zoom: 1.56, panX: 0, panY: 0 },
      SINGLE_LAYOUT,
      1,
    );
    expect(transform.viewScale).toBeCloseTo(1.56, 10);
  });
});
