import { describe, expect, it } from "vitest";

import {
  beadLibraryInheritsTypeStrandDefaults,
  inferStrandRenderBehaviorPreset,
  inferStrandRenderDefaultsForType,
  mergeLazyStrandRenderOverride,
  normalizeBeadLibraryStrandMetadata,
  pruneStrandRenderOverride,
  resolvedTypeStrandProfile,
  strandRenderDefaultsForBehaviorPreset,
  typeNeedsStrandRenderInitialization,
} from "./strand-render-migration.js";

describe("inferStrandRenderBehaviorPreset", () => {
  it("maps known slugs to behaviour presets", () => {
    expect(inferStrandRenderBehaviorPreset({ slug: "charm" })).toBe("hanging-item");
    expect(inferStrandRenderBehaviorPreset({ slug: "spacer" })).toBe("spacer");
    expect(inferStrandRenderBehaviorPreset({ slug: "crystal" })).toBe("round-bead");
  });

  it("reads legacy renderDefaults.shape", () => {
    expect(
      inferStrandRenderBehaviorPreset({
        slug: "custom",
        metadata: { renderDefaults: { shape: "rect" } },
      }),
    ).toBe("hanging-item");
    expect(
      inferStrandRenderBehaviorPreset({
        slug: "custom",
        metadata: { renderDefaults: { shape: "circle" } },
      }),
    ).toBe("round-bead");
  });

  it("infers from name keywords and falls back to round-bead", () => {
    expect(inferStrandRenderBehaviorPreset({ name: "Gold Pendant" })).toBe("hanging-item");
    expect(inferStrandRenderBehaviorPreset({ name: "Natural Stone" })).toBe("round-bead");
  });
});

describe("strand render migration helpers", () => {
  it("detects types needing initialization", () => {
    expect(typeNeedsStrandRenderInitialization({})).toBe(true);
    expect(typeNeedsStrandRenderInitialization({ strandRender: { visualScale: 1 } })).toBe(false);
  });

  it("builds hanging-item defaults with loop anchor", () => {
    const profile = strandRenderDefaultsForBehaviorPreset("hanging-item");
    expect(profile.anchorPreset).toBe("loop");
    expect(profile.orientationMode).toBe("outward");
  });

  it("prunes override keys that match inherited values", () => {
    const inherited = resolvedTypeStrandProfile(
      { visualScale: 1, orientationMode: "outward" },
      null,
    );
    const pruned = pruneStrandRenderOverride(
      { visualScale: 1, verticalOffset: 0.05 },
      inherited,
    );
    expect(pruned.visualScale).toBeUndefined();
    expect(pruned.verticalOffset).toBe(0.05);
  });

  it("merges lazy overrides and drops redundant keys", () => {
    const inherited = inferStrandRenderDefaultsForType({ slug: "charm" });
    const next = mergeLazyStrandRenderOverride(null, { visualScale: 1.1 }, inherited);
    expect(next.visualScale).toBe(1.1);
    expect(next.anchorPreset).toBeUndefined();
  });

  it("normalizes library metadata to inheritance when override is empty", () => {
    const inherited = inferStrandRenderDefaultsForType({ slug: "crystal" });
    const normalized = normalizeBeadLibraryStrandMetadata(
      { strandRenderOverride: {}, useTypeStrandDefaults: false },
      inherited,
    );
    expect(normalized.strandRenderOverride).toBeUndefined();
    expect(normalized.useTypeStrandDefaults).toBe(true);
    expect(beadLibraryInheritsTypeStrandDefaults(normalized)).toBe(true);
  });
});
