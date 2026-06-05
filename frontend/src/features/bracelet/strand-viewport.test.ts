import { describe, expect, it } from "vitest";

import { measureStrandCanvasSize } from "./strand-viewport";

describe("measureStrandCanvasSize", () => {
  it("uses more of a large desktop viewport than the old 440px cap", () => {
    const size = measureStrandCanvasSize({
      containerWidth: 1400,
      containerHeight: 900,
      isMobile: false,
      twinning: false,
      libraryOpen: true,
    });
    expect(size).toBeGreaterThan(440);
    expect(size).toBeLessThanOrEqual(580);
  });
});
