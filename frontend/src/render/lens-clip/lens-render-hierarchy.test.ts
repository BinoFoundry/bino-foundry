import { describe, expect, it } from "vitest";
import type { LensRenderingPreset } from "@bino-foundry/shared/types";

import {
  buildSparseFrameRenderOverride,
  resolveFrameLensRenderSettings,
} from "./lens-render-hierarchy";

const preset: LensRenderingPreset = {
  id: "classic",
  code: "classic-tint",
  name: "Classic Tint",
  description: "",
  displayOrder: 30,
  isActive: true,
  isDefault: true,
  isSystem: true,
  settings: {
    automaticMaterialBehavior: true,
    originalLensColorInfluence: 15,
    tintLayerOpacity: 0.43,
    reflectionOpacity: 0.2,
  },
};

describe("lens render hierarchy", () => {
  it("resolves frame override over preset over database system default", () => {
    const resolved = resolveFrameLensRenderSettings(
      { lensRenderPresetId: preset.id, useLensRenderPreset: false },
      { reflectionOpacity: 0.3 },
      [preset],
      { reflectionOpacity: 0.12, edgeDensity: 0.08 },
    );

    expect(resolved.reflectionOpacity).toBe(0.3);
    expect(resolved.tintLayerOpacity).toBe(0.43);
    expect(resolved.edgeDensity).toBe(0.08);
    expect(resolved.provenance.reflectionOpacity).toBe("frameOverride");
    expect(resolved.provenance.tintLayerOpacity).toBe("preset");
    expect(resolved.provenance.edgeDensity).toBe("system");
  });

  it("ignores stored frame values in preset mode", () => {
    const resolved = resolveFrameLensRenderSettings(
      { lensRenderPresetId: preset.id, useLensRenderPreset: true },
      { tintLayerOpacity: 0.9 },
      [preset],
      {},
    );
    expect(resolved.tintLayerOpacity).toBe(0.43);
    expect(resolved.source).toBe("preset");
  });

  it("stores only values that differ from inherited configuration", () => {
    const sparse = buildSparseFrameRenderOverride(
      preset.settings,
      {
        automaticMaterialBehavior: true,
        originalLensColorInfluence: 22,
        tintLayerOpacity: 0.43,
        reflectionOpacity: 0.26,
        reflectionPosition: 18,
        reflectionScale: 1.25,
      },
      {},
    );
    expect(sparse.tintLayerOpacity).toBeUndefined();
    expect(sparse.automaticMaterialBehavior).toBeUndefined();
    expect(sparse.originalLensColorInfluence).toBe(22);
    expect(sparse.reflectionOpacity).toBe(0.26);
    expect(sparse.reflectionPosition).toBe(18);
    expect(sparse.reflectionScale).toBe(1.25);
  });

  it("allows frame override of glass base density calibration", () => {
    const resolved = resolveFrameLensRenderSettings(
      { lensRenderPresetId: preset.id, useLensRenderPreset: false },
      {
        baseGlassDarkness: 72,
        baseGlassRichness: 88,
        baseGlassNeutralization: 40,
        mirrorReflection: false,
        reflectionRightOffsetX: 14,
      },
      [preset],
      {},
    );
    expect(resolved.baseGlassDarkness).toBe(72);
    expect(resolved.baseGlassRichness).toBe(88);
    expect(resolved.baseGlassNeutralization).toBe(40);
    expect(resolved.mirrorReflection).toBe(false);
    expect(resolved.reflectionRightOffsetX).toBe(14);
    expect(resolved.source).toBe("frameOverride");
  });
});
