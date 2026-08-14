import { describe, expect, it } from "vitest";
import { DEFAULT_STRAND_RENDER_PROFILE } from "./strand-render-profile.js";
import { resolveStrandRenderConfig } from "./strand-render-config.js";

describe("resolveStrandRenderConfig", () => {
  it("merges layers with bead override winning", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { strandOccupancy: 1, visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.1, orientationMode: "outward" },
      subBeadTypeOverride: { visualScale: 1.15 },
      inheritSubBeadTypeFromBeadType: false,
      beadOverride: { visualScale: 1.25 },
      inheritBeadFromSubBeadType: false,
    });
    expect(resolved.visualScale).toBe(1.25);
    expect(resolved.provenance.visualScale).toBe("beadOverride");
    expect(resolved.imageSizeAdjust).toBe(1);
  });

  it("inherits type when bead inherit flag is true", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { strandOccupancy: 1, visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.1, orientationMode: "outward" },
      beadOverride: { visualScale: 1.25 },
      inheritTypeDefaults: true,
    });
    expect(resolved.visualScale).toBe(1.1);
    expect(resolved.provenance.visualScale).toBe("beadType");
  });

  it("keeps parent visualScale when inheriting bead override fields", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.2, verticalOffset: 0 },
      beadOverride: { visualScale: 2, verticalOffset: 40 },
      inheritTypeDefaults: true,
    });
    expect(resolved.visualScale).toBe(1.2);
    expect(resolved.provenance.visualScale).toBe("beadType");
    expect(resolved.verticalOffset).toBe(0);
    expect(resolved.imageSizeAdjust).toBe(1);
  });

  it("applies render-size-only override while parent inherit stays on", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.2, verticalOffset: 0, layoutMode: "dangling" },
      inheritSubBeadTypeFromBeadType: true,
      inheritBeadFromSubBeadType: true,
      beadRenderSizeOnly: { visualScale: 0.65 },
    });
    expect(resolved.visualScale).toBe(0.65);
    expect(resolved.provenance.visualScale).toBe("beadOverride");
    expect(resolved.verticalOffset).toBe(0);
    expect(resolved.layoutMode).toBe("dangling");
  });

  it("applies sub-type render-size-only override while inheriting bead type", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.2, orientationMode: "outward" },
      inheritSubBeadTypeFromBeadType: true,
      subBeadTypeRenderSizeOnly: { visualScale: 0.8 },
    });
    expect(resolved.visualScale).toBe(0.8);
    expect(resolved.provenance.visualScale).toBe("subBeadType");
    expect(resolved.orientationMode).toBe("outward");
  });

  it("falls back to code defaults when no layers are set", () => {
    const resolved = resolveStrandRenderConfig({});
    expect(resolved.strandOccupancy).toBe(DEFAULT_STRAND_RENDER_PROFILE.strandOccupancy);
    expect(resolved.orientationMode).toBe("outward");
    expect(resolved.provenance.anchorPreset).toBe("system");
    expect(resolved.imageSizeAdjust).toBe(1);
  });
});
