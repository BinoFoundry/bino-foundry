import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE } from "./strand-render-profile.js";
import { resolveStrandRenderConfig } from "./strand-render-config.js";

describe("resolveStrandRenderConfig", () => {
  it("inherits system → bead type → bead override in priority order", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { strandOccupancy: 1, visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.1, rotationMode: "radial-upright" },
      beadOverride: { visualScale: 1.25 },
      inheritTypeDefaults: false,
    });
    expect(resolved.visualScale).toBe(1.25);
    expect(resolved.provenance.visualScale).toBe("beadOverride");
    expect(resolved.provenance.rotationMode).toBe("beadType");
    expect(resolved.provenance.strandOccupancy).toBe("system");
  });

  it("ignores bead override when inheriting type defaults", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.2 },
      beadOverride: { visualScale: 2 },
      inheritTypeDefaults: true,
    });
    expect(resolved.visualScale).toBe(1.2);
    expect(resolved.provenance.visualScale).toBe("beadType");
  });

  it("falls back to code defaults when no layers are set", () => {
    const resolved = resolveStrandRenderConfig({});
    expect(resolved.strandOccupancy).toBe(DEFAULT_STRAND_RENDER_PROFILE.strandOccupancy);
    expect(resolved.provenance.anchorPreset).toBe("system");
  });
});
