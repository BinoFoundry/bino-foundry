import { describe, expect, it } from "vitest";

import {
  detectFrameLensSideFromSource,
  isDualLensMaskValid,
  isLensSideValid,
  LENS_DUAL_DETECT_FAILED_MESSAGE,
  LENS_SIDE_DETECT_FAILED,
} from "./auto-detect-frame-lenses";
import { createLensPolygon, createMaskConfig } from "./mask-types";

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
});
