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

  it("keeps parent visualScale when inheriting (imageSizeAdjust is separate)", () => {
    const resolved = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.2, verticalOffset: 0 },
      beadOverride: { visualScale: 2, verticalOffset: 40 },
      inheritTypeDefaults: true,
      imageSizeAdjustBead: 1.15,
    });
    expect(resolved.visualScale).toBe(1.2);
    expect(resolved.provenance.visualScale).toBe("beadType");
    expect(resolved.verticalOffset).toBe(0);
    expect(resolved.imageSizeAdjust).toBe(1.15);
  });

  it("defaults imageSizeAdjust to 1 when unset", () => {
    const resolved = resolveStrandRenderConfig({
      beadTypeDefaults: { visualScale: 1.2, layoutMode: "dangling" },
      beadOverride: { visualScale: 2 },
      inheritTypeDefaults: true,
    });
    expect(resolved.visualScale).toBe(1.2);
    expect(resolved.imageSizeAdjust).toBe(1);
    expect(resolved.layoutMode).toBe("dangling");
  });

  it("prefers bead imageSizeAdjust over sub-type", () => {
    const resolved = resolveStrandRenderConfig({
      beadTypeDefaults: { visualScale: 1.1, layoutMode: "dangling", verticalOffset: 0 },
      inheritSubBeadTypeFromBeadType: true,
      imageSizeAdjustSubBeadType: 0.9,
      inheritBeadFromSubBeadType: true,
      imageSizeAdjustBead: 1.25,
    });
    expect(resolved.visualScale).toBe(1.1);
    expect(resolved.imageSizeAdjust).toBe(1.25);
    expect(resolved.layoutMode).toBe("dangling");
  });

  it("falls back to code defaults when no layers are set", () => {
    const resolved = resolveStrandRenderConfig({});
    expect(resolved.strandOccupancy).toBe(DEFAULT_STRAND_RENDER_PROFILE.strandOccupancy);
    expect(resolved.orientationMode).toBe("outward");
    expect(resolved.provenance.anchorPreset).toBe("system");
    expect(resolved.imageSizeAdjust).toBe(1);
  });
});
