import { describe, expect, it } from "vitest";

import {
  LENS_RENDER_SYSTEM_DEFAULTS,
  LENS_RENDER_ZERO_SETTINGS,
  pickLensRenderPresetSettings,
  pruneLensRenderOverride,
  resolveLensRenderConfig,
} from "./lens-render-config.js";

describe("LENS_RENDER_ZERO_SETTINGS", () => {
  it("uses identity values so the renderer draws only the original lens", () => {
    expect(LENS_RENDER_ZERO_SETTINGS.automaticMaterialBehavior).toBe(false);
    expect(LENS_RENDER_ZERO_SETTINGS.originalLensColorInfluence).toBe(100);
    expect(LENS_RENDER_ZERO_SETTINGS.materialInfluence).toBe(100);
    expect(LENS_RENDER_ZERO_SETTINGS.baseBrightness).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.baseGamma).toBe(1);
    expect(LENS_RENDER_ZERO_SETTINGS.glassAbsorption).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.glassDiffusion).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.glassDepth).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.tintLayerOpacity).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.lensOpacity).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.reflectionOpacity).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.internalReflectionOpacity).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.fresnelStrength).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.edgeDarkness).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.backgroundVisibility).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.environmentTransparency).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.centerDensity).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.edgeDensity).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.edgeOpacity).toBe(0);
    // Auxiliary layer strengths must also be zero — no hidden defaults leak through.
    expect(LENS_RENDER_ZERO_SETTINGS.gradientStrength).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.reflectionStrength).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.edgeFade).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.polarizedStrength).toBe(0);
    expect(LENS_RENDER_ZERO_SETTINGS.reflectionEnabled).toBe(false);
    expect(LENS_RENDER_ZERO_SETTINGS.internalReflectionEnabled).toBe(false);
    expect(LENS_RENDER_ZERO_SETTINGS.fresnelEnabled).toBe(false);
    expect(LENS_RENDER_ZERO_SETTINGS.vignetteEnabled).toBe(false);
    expect(LENS_RENDER_ZERO_SETTINGS.gradientEnabled).toBe(false);
    expect(LENS_RENDER_ZERO_SETTINGS.polarizedEnabled).toBe(false);
  });
});

describe("resolveLensRenderConfig", () => {
  it("inherits preset over system defaults when usePreset is true", () => {
    const resolved = resolveLensRenderConfig({
      systemDefaults: LENS_RENDER_SYSTEM_DEFAULTS,
      preset: {
        materialInfluence: 82,
        baseBrightness: 12,
        baseGamma: 1.25,
        glassAbsorption: 40,
        glassDiffusion: 22,
        glassDepth: 70,
        tintLayerOpacity: 0.6,
        lensOpacity: 0.85,
      },
      frameOverride: { tintLayerOpacity: 0.1 },
      usePreset: true,
    });
    expect(resolved.materialInfluence).toBe(82);
    expect(resolved.baseBrightness).toBe(12);
    expect(resolved.baseGamma).toBe(1.25);
    expect(resolved.glassAbsorption).toBe(40);
    expect(resolved.glassDiffusion).toBe(22);
    expect(resolved.glassDepth).toBe(70);
    expect(resolved.tintLayerOpacity).toBe(0.6);
    expect(resolved.lensOpacity).toBe(0.85);
    expect(resolved.source).toBe("preset");
    expect(resolved.provenance.tintLayerOpacity).toBe("preset");
  });

  it("resolves a database system default beneath a sparse preset", () => {
    const resolved = resolveLensRenderConfig({
      systemDefaults: {
        automaticMaterialBehavior: false,
        originalLensColorInfluence: 12,
        reflectionOpacity: 0.31,
        edgeDensity: 0.22,
      },
      preset: { tintLayerOpacity: 0.55 },
      usePreset: true,
    });
    expect(resolved.automaticMaterialBehavior).toBe(false);
    expect(resolved.originalLensColorInfluence).toBe(12);
    expect(resolved.tintLayerOpacity).toBe(0.55);
    expect(resolved.reflectionOpacity).toBe(0.31);
    expect(resolved.edgeDensity).toBe(0.22);
    expect(resolved.provenance.tintLayerOpacity).toBe("preset");
    expect(resolved.provenance.reflectionOpacity).toBe("system");
  });

  it("applies sparse frame overrides only when usePreset is false", () => {
    const resolved = resolveLensRenderConfig({
      systemDefaults: LENS_RENDER_SYSTEM_DEFAULTS,
      preset: { tintLayerOpacity: 0.6, lensOpacity: 0.85 },
      frameOverride: { tintLayerOpacity: 0.2 },
      usePreset: false,
    });
    expect(resolved.tintLayerOpacity).toBe(0.2);
    expect(resolved.lensOpacity).toBe(0.85);
    expect(resolved.source).toBe("frameOverride");
    expect(resolved.provenance.tintLayerOpacity).toBe("frameOverride");
    expect(resolved.provenance.lensOpacity).toBe("preset");
  });

  it("prunes overrides that match the inherited baseline", () => {
    const sparse = pruneLensRenderOverride(
      { tintLayerOpacity: 0.5, lensOpacity: 0.9 },
      { tintLayerOpacity: 0.5, lensOpacity: 0.7, edgeDensity: 0.1 },
    );
    expect(sparse.tintLayerOpacity).toBeUndefined();
    expect(sparse.lensOpacity).toBe(0.7);
    expect(sparse.edgeDensity).toBe(0.1);
  });

  it("promotes legacy glassMaterialStrength into materialInfluence when picking settings", () => {
    const picked = pickLensRenderPresetSettings({
      glassMaterialStrength: 72,
      tintLayerOpacity: 0.4,
    });
    expect(picked.materialInfluence).toBe(72);
    expect(picked.tintLayerOpacity).toBe(0.4);
    expect(picked.glassMaterialStrength).toBeUndefined();
  });
});
