import { describe, expect, it } from "vitest";

import { DEFAULT_LENS_CLIP_RENDER } from "./clip-settings";
import {
  REPLACE_LENS_PIPELINE_STEPS,
  computeLensBodyOpacity,
  computeLensEdgeWidthPx,
  computeReflectionBlurPx,
  resolveLensGlassMaterialParams,
} from "./lens-glass-material";

describe("lens-glass-material", () => {
  it("attenuates body opacity from transmission without removing surface layers", () => {
    expect(computeLensBodyOpacity(0.9, 0)).toBeCloseTo(0.9);
    expect(computeLensBodyOpacity(0.9, 1)).toBeCloseTo(0.9 * 0.65);
  });

  it("derives edge width and reflection blur from plate dimensions", () => {
    expect(computeLensEdgeWidthPx(0.006, 800, 600)).toBeCloseTo(3.6);
    expect(computeReflectionBlurPx(0.5, 800, 600)).toBeCloseTo(1.8);
  });

  it("bundles resolved glass material params for the compositor", () => {
    const params = resolveLensGlassMaterialParams(
      {
        lensOpacity: 0.92,
        lensTransmission: 0.58,
        edgeWidth: 0.006,
        reflectionBlur: 0.58,
      },
      800,
      600,
    );

    expect(params.bodyOpacity).toBeCloseTo(0.92 * (1 - 0.58 * 0.35));
    expect(params.edgeWidthPx).toBeCloseTo(3.6);
    expect(params.reflectionBlurPx).toBeCloseTo(2.088);
  });

  it("documents layered lens order with original lens and exclusions last", () => {
    expect(REPLACE_LENS_PIPELINE_STEPS[0]).toBe("knockout-frame-plate");
    expect(REPLACE_LENS_PIPELINE_STEPS).toContain("original-lens");
    expect(REPLACE_LENS_PIPELINE_STEPS).toContain("tint-layer");
    expect(REPLACE_LENS_PIPELINE_STEPS.at(-1)).toBe("frame-exclusions");
    expect(DEFAULT_LENS_CLIP_RENDER.lensTransmission).toBeGreaterThan(0);
  });
});
