import { describe, expect, it } from "vitest";

import { labelMaskComponents, traceOuterContour } from "./mask-contour";

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
});
