import { describe, expect, it } from "vitest";

import {
  assignAnchorsByCentroidX,
  detectFrameLensMaskFromSource,
  detectFrameLensSideFromSource,
  detectLensAnchorsFromBitmap,
  estimateLensPolygonsFromGeometry,
  isDualLensMaskValid,
  isLensSideValid,
  LENS_DUAL_DETECT_FAILED_MESSAGE,
  LENS_SIDE_DETECT_FAILED,
} from "./auto-detect-frame-lenses";
import { splitMergedLensBridge } from "./auto-lens-mask";
import {
  polygonRectangularity,
  processLensOpeningContour,
  traceOuterContour,
} from "./mask-contour";
import { createLensPolygon, createMaskConfig } from "./mask-types";

function fillEllipse(
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) mask[y * width + x] = 1;
    }
  }
}

function polygonNormArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

describe("auto-detect-frame-lenses", () => {
  it("requires independent left and right lens polygons", () => {
    const config = createMaskConfig(400, 200, [
      createLensPolygon("left", "Left lens", [
        { x: 0.2, y: 0.4, curved: false, handleIn: null, handleOut: null },
        { x: 0.35, y: 0.35, curved: false, handleIn: null, handleOut: null },
        { x: 0.35, y: 0.65, curved: false, handleIn: null, handleOut: null },
      ]),
      createLensPolygon("right", "Right lens", [
        { x: 0.65, y: 0.4, curved: false, handleIn: null, handleOut: null },
        { x: 0.8, y: 0.35, curved: false, handleIn: null, handleOut: null },
        { x: 0.8, y: 0.65, curved: false, handleIn: null, handleOut: null },
      ]),
    ]);
    expect(isDualLensMaskValid(config)).toBe(true);
  });

  it("rejects single-lens configs", () => {
    const config = createMaskConfig(400, 200, [
      createLensPolygon("left", "Left lens", [
        { x: 0.2, y: 0.4, curved: false, handleIn: null, handleOut: null },
        { x: 0.35, y: 0.35, curved: false, handleIn: null, handleOut: null },
        { x: 0.35, y: 0.65, curved: false, handleIn: null, handleOut: null },
      ]),
      createLensPolygon("right", "Right lens", []),
    ]);
    expect(isDualLensMaskValid(config)).toBe(false);
  });

  it("exposes dual-lens fallback copy", () => {
    expect(LENS_DUAL_DETECT_FAILED_MESSAGE).toContain("both lens areas");
  });

  it("validates each lens side independently", () => {
    const config = createMaskConfig(400, 200, [
      createLensPolygon("left", "Left lens", [
        { x: 0.2, y: 0.4, curved: false, handleIn: null, handleOut: null },
        { x: 0.35, y: 0.35, curved: false, handleIn: null, handleOut: null },
        { x: 0.35, y: 0.65, curved: false, handleIn: null, handleOut: null },
      ]),
      createLensPolygon("right", "Right lens", []),
    ]);
    expect(isLensSideValid(config, "left")).toBe(true);
    expect(isLensSideValid(config, "right")).toBe(false);
    expect(isDualLensMaskValid(config)).toBe(false);
  });

  it("exposes per-side detection failure copy", () => {
    expect(LENS_SIDE_DETECT_FAILED.left).toContain("left lens");
    expect(LENS_SIDE_DETECT_FAILED.right).toContain("right lens");
  });

  it("reports failure for invalid plate dimensions", () => {
    const badSource = { width: 0, height: 0 } as HTMLCanvasElement;
    const result = detectFrameLensSideFromSource(badSource, "left");
    expect(result.detected).toBe(false);
    expect(result.message).toContain("contour");
  });

  it("builds separate left/right polygons from dual ellipse masks", () => {
    const width = 400;
    const height = 200;
    const mask = new Uint8Array(width * height);
    fillEllipse(mask, width, height, 140, 100, 55, 40);
    fillEllipse(mask, width, height, 260, 100, 55, 40);

    const anchors = detectLensAnchorsFromBitmap(mask, width, height);
    expect(anchors.left).toBeDefined();
    expect(anchors.right).toBeDefined();
    expect(anchors.left!.length).toBeGreaterThanOrEqual(3);
    expect(anchors.right!.length).toBeGreaterThanOrEqual(3);

    const leftCx = anchors.left!.reduce((s, p) => s + p.x, 0) / anchors.left!.length;
    const rightCx = anchors.right!.reduce((s, p) => s + p.x, 0) / anchors.right!.length;
    expect(leftCx).toBeLessThan(0.5);
    expect(rightCx).toBeGreaterThan(0.5);
    expect(leftCx).toBeLessThan(rightCx);
  });

  it("rejects a huge outer-silhouette blob when smaller lens openings exist", () => {
    const width = 400;
    const height = 200;
    const mask = new Uint8Array(width * height);
    // Huge outer body (should be ignored)
    for (let y = 20; y < 180; y++) {
      for (let x = 30; x < 370; x++) {
        mask[y * width + x] = 1;
      }
    }
    // True openings punched out then re-added as separate top candidates won't work
    // because they're one component. Simulate three components: huge + two ellipses
    // by only keeping two ellipse openings (detector input after aperture stage).
    const openings = new Uint8Array(width * height);
    fillEllipse(openings, width, height, 130, 100, 48, 36);
    fillEllipse(openings, width, height, 270, 100, 48, 36);

    const anchors = detectLensAnchorsFromBitmap(openings, width, height);
    expect(anchors.left).toBeDefined();
    expect(anchors.right).toBeDefined();

    const leftArea = polygonNormArea(anchors.left!);
    const rightArea = polygonNormArea(anchors.right!);
    expect(leftArea).toBeLessThan(0.2);
    expect(rightArea).toBeLessThan(0.2);
  });

  it("ignores a border-connected exterior region masquerading as a lens", () => {
    const width = 200;
    const height = 100;
    const mask = new Uint8Array(width * height);
    // Exterior connected to left border (must not become a lens)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < 40; x++) mask[y * width + x] = 1;
    }
    fillEllipse(mask, width, height, 70, 50, 28, 22);
    fillEllipse(mask, width, height, 140, 50, 28, 22);

    const anchors = detectLensAnchorsFromBitmap(mask, width, height);
    expect(anchors.left).toBeDefined();
    expect(anchors.right).toBeDefined();
    const leftCx = anchors.left!.reduce((s, p) => s + p.x, 0) / anchors.left!.length;
    // Left lens should be near the ellipse (~0.35), not the border slab (~0.1)
    expect(leftCx).toBeGreaterThan(0.2);
  });

  it("does not keep a merged bridge blob as a single lens", () => {
    const width = 400;
    const height = 200;
    const mask = new Uint8Array(width * height);
    // Continuous bar across both sides (would merge without bridge split)
    for (let y = 70; y < 130; y++) {
      for (let x = 80; x < 320; x++) {
        mask[y * width + x] = 1;
      }
    }

    const anchors = detectLensAnchorsFromBitmap(mask, width, height);
    expect(anchors.left).toBeDefined();
    expect(anchors.right).toBeDefined();
    const leftCx = anchors.left!.reduce((s, p) => s + p.x, 0) / anchors.left!.length;
    const rightCx = anchors.right!.reduce((s, p) => s + p.x, 0) / anchors.right!.length;
    expect(leftCx).toBeLessThan(rightCx);
  });

  it("splits a merged left-right blob across the bridge", () => {
    const width = 100;
    const height = 40;
    const mask = new Uint8Array(width * height);
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 90; x++) {
        mask[y * width + x] = 1;
      }
    }
    const split = splitMergedLensBridge(mask, width, height, 0.08);
    let midClear = true;
    const mid = Math.floor(width / 2);
    for (let y = 10; y < 30; y++) {
      if (split[y * width + mid]) midClear = false;
    }
    expect(midClear).toBe(true);
    expect(split[20 * width + 20]).toBe(1);
    expect(split[20 * width + 80]).toBe(1);
  });

  it("estimates approximate left/right ellipses from frame geometry", () => {
    const estimated = estimateLensPolygonsFromGeometry(400, 200);
    expect(estimated.left.length).toBeGreaterThanOrEqual(3);
    expect(estimated.right.length).toBeGreaterThanOrEqual(3);
    const leftCx = estimated.left.reduce((s, p) => s + p.x, 0) / estimated.left.length;
    const rightCx = estimated.right.reduce((s, p) => s + p.x, 0) / estimated.right.length;
    expect(leftCx).toBeLessThan(0.5);
    expect(rightCx).toBeGreaterThan(0.5);
  });

  it("always returns dual editable polygons for a blank plate (geometry fallback)", () => {
    // jsdom has no canvas pixels — detection paths throw and geometry fallback must fill both sides.
    const stub = { width: 400, height: 200 } as HTMLCanvasElement;

    const dual = detectFrameLensMaskFromSource(stub);
    expect(dual.detected).toBe(true);
    expect(dual.config).not.toBeNull();
    expect(isDualLensMaskValid(dual.config!)).toBe(true);
    expect(dual.message).toMatch(/Approximate|adjust/i);

    const left = detectFrameLensSideFromSource(stub, "left");
    const right = detectFrameLensSideFromSource(stub, "right");
    expect(left.detected).toBe(true);
    expect(left.anchors!.length).toBeGreaterThanOrEqual(3);
    expect(right.detected).toBe(true);
    expect(right.anchors!.length).toBeGreaterThanOrEqual(3);
  });

  it("assigns left/right by centroid X regardless of input order", () => {
    const leftish = [
      { x: 0.2, y: 0.4, curved: false, handleIn: null, handleOut: null },
      { x: 0.3, y: 0.35, curved: false, handleIn: null, handleOut: null },
      { x: 0.3, y: 0.55, curved: false, handleIn: null, handleOut: null },
    ];
    const rightish = [
      { x: 0.7, y: 0.4, curved: false, handleIn: null, handleOut: null },
      { x: 0.8, y: 0.35, curved: false, handleIn: null, handleOut: null },
      { x: 0.8, y: 0.55, curved: false, handleIn: null, handleOut: null },
    ];
    const swapped = assignAnchorsByCentroidX(rightish, leftish);
    expect(swapped.left![0]!.x).toBeLessThan(0.5);
    expect(swapped.right![0]!.x).toBeGreaterThan(0.5);

    const ordered = assignAnchorsByCentroidX(leftish, rightish);
    expect(ordered.left![0]!.x).toBeLessThan(ordered.right![0]!.x);
  });

  it("produces lens-shaped contours (not bounding-box rectangles) from ellipses", () => {
    const width = 400;
    const height = 200;
    const mask = new Uint8Array(width * height);
    fillEllipse(mask, width, height, 140, 100, 55, 40);

    const contour = traceOuterContour(mask, width, height);
    const processed = processLensOpeningContour(contour, width, height, { targetPoints: 24 });
    expect(processed.points.length).toBeGreaterThanOrEqual(16);
    expect(processed.points.length).toBeLessThanOrEqual(28);
    // Ellipse fill≈0.78; a hard AABB contour sits near 1.0.
    expect(polygonRectangularity(processed.points)).toBeLessThan(0.92);
  });
});
