import { describe, expect, it } from "vitest";

import { DEFAULT_LENS_CLIP_RENDER } from "./clip-settings";
import {
  REPLACE_LENS_PIPELINE_STEPS,
  MATERIAL_INFLUENCE_VALUE_BLEND_GAIN,
  computeLensBodyOpacity,
  computeLensEdgeWidthPx,
  computeReflectionBlurPx,
  resolveGlassMaterialEffects,
  resolveAutomaticLensMaterial,
  resolveLensManualCalibration,
  resolveLensGlassMaterialParams,
  resolveMaterialInfluence,
  resolveReflectionLayerOpacity,
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

  it("keeps independent glass effects at identity when all are zero", () => {
    const material = resolveGlassMaterialEffects(0, 0, 0);
    expect(material.isIdentity).toBe(true);
    expect(material.lightScatterOpacity).toBe(0);
    expect(material.absorptionOpacity).toBe(0);
    expect(material.diffusionBlurFactor).toBe(0);
    expect(material.depthOpacity).toBe(0);
  });

  it("resolves each manually configured glass property", () => {
    const material = resolveGlassMaterialEffects(100, 100, 100);
    expect(material.isIdentity).toBe(false);
    expect(material.lightScatterOpacity).toBeCloseTo(0.23);
    expect(material.absorptionOpacity).toBeCloseTo(0.6);
    expect(material.diffusionBlurFactor).toBeCloseTo(0.012);
    expect(material.depthOpacity).toBeCloseTo(0.24);
    expect(material.edgeHighlightOpacity).toBeCloseTo(0.18);
  });

  it("keeps manual tonal calibration identity at 0 brightness and gamma 1", () => {
    expect(resolveLensManualCalibration(0, 1)).toEqual({
      brightnessOffset: 0,
      gamma: 1,
      isIdentity: true,
    });
  });

  it("maps manual source calibration without image analysis", () => {
    const calibration = resolveLensManualCalibration(40, 1.8);
    expect(calibration.isIdentity).toBe(false);
    expect(calibration.brightnessOffset).toBeCloseTo(0.2);
    expect(calibration.gamma).toBeCloseTo(1.8);
  });

  it("maps Material Influence to dual blend weights without changing alpha semantics", () => {
    expect(resolveMaterialInfluence(0)).toEqual({
      influence: 0,
      luminancePreserveFactor: 0,
      valueDominanceFactor: 1,
      valueBlendGain: MATERIAL_INFLUENCE_VALUE_BLEND_GAIN,
    });
    expect(resolveMaterialInfluence(100)).toEqual({
      influence: 1,
      luminancePreserveFactor: 1,
      valueDominanceFactor: 0,
      valueBlendGain: MATERIAL_INFLUENCE_VALUE_BLEND_GAIN,
    });
    const mid = resolveMaterialInfluence(65);
    expect(mid.luminancePreserveFactor).toBeCloseTo(0.65);
    expect(mid.valueDominanceFactor).toBeCloseTo(0.35);
    expect(mid.luminancePreserveFactor + mid.valueDominanceFactor).toBeCloseTo(1);
  });

  it("derives richer optics for darker automatic tint", () => {
    const light = resolveAutomaticLensMaterial(0.15);
    const dark = resolveAutomaticLensMaterial(0.8);
    expect(dark.reflectionOpacity).toBeGreaterThan(light.reflectionOpacity);
    expect(dark.reflectionStrength).toBeGreaterThan(light.reflectionStrength);
    expect(dark.glassDepth).toBeGreaterThan(light.glassDepth);
    expect(dark.materialInfluence).toBeGreaterThan(light.materialInfluence);
    expect(dark.lensOpacity).toBeGreaterThan(light.lensOpacity);
    expect(dark.edgeDensity).toBeGreaterThan(light.edgeDensity);
    expect(dark.backgroundVisibility).toBeLessThan(light.backgroundVisibility);
    expect(dark.environmentTransparency).toBeLessThan(light.environmentTransparency);
  });

  it("combines manual reflection opacity and intensity without tint coupling", () => {
    expect(resolveReflectionLayerOpacity(0.2, 0.5)).toBeCloseTo(0.1);
    expect(resolveReflectionLayerOpacity(1, 1)).toBe(1);
  });

  it("documents inserted-glass pipeline order", () => {
    expect(REPLACE_LENS_PIPELINE_STEPS[0]).toBe("frame-back");
    expect(REPLACE_LENS_PIPELINE_STEPS).toContain("behind-glass-objects");
    expect(REPLACE_LENS_PIPELINE_STEPS).toContain("glass-element-kaca-tint");
    expect(REPLACE_LENS_PIPELINE_STEPS).toContain("glass-element-specular");
    expect(REPLACE_LENS_PIPELINE_STEPS).toContain("front-of-glass-objects");
    expect(REPLACE_LENS_PIPELINE_STEPS.at(-1)).toBe("frame-front");
    expect(REPLACE_LENS_PIPELINE_STEPS.indexOf("behind-glass-objects")).toBeLessThan(
      REPLACE_LENS_PIPELINE_STEPS.indexOf("glass-element-kaca-tint"),
    );
    expect(REPLACE_LENS_PIPELINE_STEPS.indexOf("glass-element-kaca-tint")).toBeLessThan(
      REPLACE_LENS_PIPELINE_STEPS.indexOf("front-of-glass-objects"),
    );
    expect(DEFAULT_LENS_CLIP_RENDER.lensTransmission).toBeGreaterThan(0);
  });
});
