import { describe, expect, it } from "vitest";

import { resolveGlassMaterialFilterParams } from "./glass-material-filter";
import { DEFAULT_LENS_CLIP_RENDER } from "./clip-settings";

describe("resolveGlassMaterialFilterParams", () => {
  it("enables reflection module only when reflection is on", () => {
    const off = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        reflectionEnabled: false,
        tintLayerOpacity: 0.6,
      },
      200,
      120,
    );
    const on = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        reflectionEnabled: true,
        reflectionOpacity: 0.3,
        reflectionStrength: 0.5,
        tintLayerOpacity: 0.6,
      },
      200,
      120,
    );
    expect(off.reflection.enabled).toBe(false);
    expect(on.reflection.enabled).toBe(true);
    expect(on.reflection.opacity).toBeCloseTo(0.15);
  });

  it("maps absorption and density into filter gains", () => {
    const light = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        glassAbsorption: 10,
        glassDepth: 20,
        centerDensity: 0,
        tintLayerOpacity: 1,
        lensOpacity: 1,
        environmentTransparency: 0,
        backgroundVisibility: 0,
      },
      100,
      100,
    );
    const heavy = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        glassAbsorption: 80,
        glassDepth: 90,
        centerDensity: 0.3,
        tintLayerOpacity: 1,
        lensOpacity: 1,
        environmentTransparency: 0,
        backgroundVisibility: 0,
      },
      100,
      100,
    );
    expect(heavy.absorptionGain).toBeGreaterThan(light.absorptionGain);
    expect(heavy.edgeDensity).toBeGreaterThanOrEqual(0);
  });
});
