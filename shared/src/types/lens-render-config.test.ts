import { describe, expect, it } from "vitest";

import {
  LENS_RENDER_SYSTEM_DEFAULTS,
  pruneLensRenderOverride,
  resolveLensRenderConfig,
} from "./lens-render-config.js";

describe("resolveLensRenderConfig", () => {
  it("inherits preset over system defaults when usePreset is true", () => {
    const resolved = resolveLensRenderConfig({
      systemDefaults: LENS_RENDER_SYSTEM_DEFAULTS,
      preset: { tintLayerOpacity: 0.6, lensOpacity: 0.85 },
      frameOverride: { tintLayerOpacity: 0.1 },
      usePreset: true,
    });
    expect(resolved.tintLayerOpacity).toBe(0.6);
    expect(resolved.lensOpacity).toBe(0.85);
    expect(resolved.source).toBe("preset");
    expect(resolved.provenance.tintLayerOpacity).toBe("preset");
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
});
