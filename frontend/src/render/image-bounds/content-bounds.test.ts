import { describe, expect, it } from "vitest";

import { detectContentBoundsFromRgba } from "./content-bounds";

describe("detectContentBoundsFromRgba", () => {
  it("trims transparent margins from a sparse plate", () => {
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 6; y <= 13; y++) {
      for (let x = 4; x <= 15; x++) {
        const i = (y * width + x) * 4;
        data[i] = 40;
        data[i + 1] = 40;
        data[i + 2] = 40;
        data[i + 3] = 255;
      }
    }

    const bounds = detectContentBoundsFromRgba(data, width, height, { paddingPx: 0 });
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(4);
    expect(bounds!.y).toBe(6);
    expect(bounds!.width).toBe(12);
    expect(bounds!.height).toBe(8);
  });

  it("returns null when image is fully empty", () => {
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    expect(detectContentBoundsFromRgba(data, width, height)).toBeNull();
  });
});
