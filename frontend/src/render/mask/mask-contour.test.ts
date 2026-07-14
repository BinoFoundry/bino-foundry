import { describe, expect, it } from "vitest";

import {
  decimateContour,
  labelMaskComponents,
  polygonRectangularity,
  processLensOpeningContour,
  processSilhouetteContour,
  resampleClosedContour,
  smoothContourChaikin,
  traceOuterContour,
} from "./mask-contour";

describe("mask-contour", () => {
  it("labels separate blobs", () => {
    const width = 20;
    const height = 10;
    const mask = new Uint8Array(width * height);
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 6; x++) mask[y * width + x] = 1;
      for (let x = 12; x <= 16; x++) mask[y * width + x] = 1;
    }

    const components = labelMaskComponents(mask, width, height);
    expect(components).toHaveLength(2);
    expect(components[0]!.size).toBeGreaterThan(0);
  });

  it("traces a rectangular contour", () => {
    const width = 12;
    const height = 12;
    const mask = new Uint8Array(width * height);
    for (let y = 3; y <= 8; y++) {
      for (let x = 3; x <= 8; x++) mask[y * width + x] = 1;
    }

    const contour = traceOuterContour(mask, width, height);
    expect(contour.length).toBeGreaterThanOrEqual(4);
  });

  it("smooths and simplifies a dense contour", () => {
    const width = 80;
    const height = 80;
    const mask = new Uint8Array(width * height);
    for (let y = 20; y <= 60; y++) {
      for (let x = 20; x <= 60; x++) {
        if ((x - 40) ** 2 + (y - 40) ** 2 <= 18 ** 2) mask[y * width + x] = 1;
      }
    }
    const raw = traceOuterContour(mask, width, height);
    const processed = processSilhouetteContour(raw, width, height, { targetPoints: 20 });
    expect(processed.rawPointCount).toBeGreaterThan(processed.points.length);
    expect(processed.points.length).toBeLessThanOrEqual(22);
    expect(processed.perimeter).toBeGreaterThan(0);
  });

  it("lens opening processing keeps a curved (non-box) ellipse polygon", () => {
    const width = 80;
    const height = 80;
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = (x - 40) / 22;
        const ny = (y - 40) / 16;
        if (nx * nx + ny * ny <= 1) mask[y * width + x] = 1;
      }
    }
    const raw = traceOuterContour(mask, width, height);
    const processed = processLensOpeningContour(raw, width, height, { targetPoints: 24 });
    expect(processed.points.length).toBe(24);
    expect(polygonRectangularity(processed.points)).toBeLessThan(0.92);
  });

  it("resamples a closed contour to a fixed point budget", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const resampled = resampleClosedContour(square, 8);
    expect(resampled).toHaveLength(8);
  });

  it("chaikin smoothing reduces stair-step jaggedness", () => {
    const zigzag = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
    ];
    const smoothed = smoothContourChaikin(zigzag, 1);
    expect(smoothed.length).toBe(zigzag.length * 2);
    const decimated = decimateContour(smoothed, 2);
    expect(decimated.length).toBeGreaterThanOrEqual(3);
  });
});