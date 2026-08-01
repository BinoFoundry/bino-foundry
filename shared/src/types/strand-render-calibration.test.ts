import { describe, expect, it } from "vitest";

import { resolveStrandRenderConfig, resolvedRenderScale } from "./strand-render-config.js";

describe("hierarchical render calibration", () => {
  it("resolves Individual → Sub → Type → System into resolvedRenderScale", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 0.95 },
      subBeadTypeOverride: { visualScale: 0.9 },
      inheritSubBeadTypeFromBeadType: false,
      beadOverride: { visualScale: 0.85 },
      inheritBeadFromSubBeadType: false,
    });

    expect(resolved.resolvedRenderScale).toBe(0.85);
    expect(resolvedRenderScale(resolved)).toBe(0.85);
    expect(resolved.provenance.visualScale).toBe("beadOverride");
  });

  it("inherits bead type when sub-type uses parent calibration", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 0.95 },
      subBeadTypeOverride: { visualScale: 0.7 },
      inheritSubBeadTypeFromBeadType: true,
    });

    expect(resolved.resolvedRenderScale).toBe(0.95);
    expect(resolved.provenance.visualScale).toBe("beadType");
  });

  it("inherits system default when no type override exists", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
    });

    expect(resolved.resolvedRenderScale).toBe(1);
    expect(resolved.provenance.visualScale).toBe("system");
  });

  it("uses sub-type override when parent calibration is disabled", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 0.95 },
      subBeadTypeOverride: { visualScale: 0.9 },
      inheritSubBeadTypeFromBeadType: false,
    });

    expect(resolved.resolvedRenderScale).toBe(0.9);
    expect(resolved.provenance.visualScale).toBe("subBeadType");
  });
});
