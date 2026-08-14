import { describe, expect, it } from "vitest";

import {
  beadLibraryInheritsTypeStrandDefaults,
  inferStrandRenderBehaviorPreset,
  inferStrandRenderDefaultsForType,
  mergeLazyStrandRenderOverride,
  normalizeBeadLibraryStrandMetadata,
  normalizeSubBeadTypeStrandMetadata,
  pruneStrandRenderOverride,
  resolvedTypeStrandProfile,
  strandRenderDefaultsForBehaviorPreset,
  subBeadTypeInheritsBeadTypeStrandDefaults,
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
      { visualScale: 1, verticalOffset: 5 },
      inherited,
    );
    expect(pruned.visualScale).toBeUndefined();
    expect(pruned.verticalOffset).toBe(5);
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
      { strandRenderOverride: {} },
      inherited,
    );
    expect(normalized.strandRenderOverride).toBeUndefined();
    expect(normalized.strandRenderCustomizedFields).toBeUndefined();
    expect(beadLibraryInheritsTypeStrandDefaults(normalized)).toBe(true);
  });

  it("clears legacy inherit opt-out when override is empty", () => {
    const inherited = inferStrandRenderDefaultsForType({ slug: "crystal" });
    const library = normalizeBeadLibraryStrandMetadata(
      { strandRenderOverride: {}, useTypeStrandDefaults: false },
      inherited,
    );
    expect(library.useTypeStrandDefaults).toBeUndefined();
    expect(beadLibraryInheritsTypeStrandDefaults(library)).toBe(true);

    const subType = normalizeSubBeadTypeStrandMetadata(
      { useBeadTypeStrandDefaults: false },
      inherited,
    );
    expect(subType.useBeadTypeStrandDefaults).toBeUndefined();
    expect(subType.strandRenderOverride).toBeUndefined();
    expect(subBeadTypeInheritsBeadTypeStrandDefaults(subType)).toBe(true);
  });

  it("migrates legacy render-size customize to visualScale field group", () => {
    const inherited = inferStrandRenderDefaultsForType({ slug: "charm" });
    const library = normalizeBeadLibraryStrandMetadata(
      {
        useTypeStrandDefaults: true,
        customizeRenderSize: true,
        strandRenderOverride: { visualScale: 0.75, verticalOffset: 12, layoutMode: "inline" },
      },
      inherited,
    );
    expect(library.useTypeStrandDefaults).toBeUndefined();
    expect(library.customizeRenderSize).toBeUndefined();
    expect(library.imageSizeAdjust).toBeUndefined();
    expect(library.strandRenderCustomizedFields).toEqual(["visualScale"]);
    expect(beadLibraryInheritsTypeStrandDefaults(library)).toBe(false);
    expect(library.strandRenderOverride).toEqual(
      expect.objectContaining({ visualScale: 0.75 }),
    );
    expect(
      (library.strandRenderOverride as { verticalOffset?: number }).verticalOffset,
    ).toBeUndefined();

    const followParent = normalizeBeadLibraryStrandMetadata(
      {
        useTypeStrandDefaults: true,
        customizeRenderSize: false,
        strandRenderOverride: { visualScale: 1.15 },
      },
      inherited,
    );
    expect(followParent.customizeRenderSize).toBeUndefined();
    expect(followParent.strandRenderOverride).toBeUndefined();

    const subType = normalizeSubBeadTypeStrandMetadata(
      {
        useBeadTypeStrandDefaults: true,
        customizeRenderSize: true,
        strandRenderOverride: { visualScale: 0.85, hangOffset: 0.4 },
      },
      inherited,
    );
    expect(subType.useBeadTypeStrandDefaults).toBeUndefined();
    expect(subType.customizeRenderSize).toBeUndefined();
    expect(subType.strandRenderCustomizedFields).toEqual(["visualScale"]);
    expect(subBeadTypeInheritsBeadTypeStrandDefaults(subType)).toBe(false);
    expect(subType.strandRenderOverride).toEqual(
      expect.objectContaining({ visualScale: 0.85 }),
    );
    expect(
      (subType.strandRenderOverride as { hangOffset?: number }).hangOffset,
    ).toBeUndefined();
  });

  it("treats empty metadata as inheriting parent defaults", () => {
    expect(subBeadTypeInheritsBeadTypeStrandDefaults({ useBeadTypeStrandDefaults: false })).toBe(
      true,
    );
    expect(subBeadTypeInheritsBeadTypeStrandDefaults({ useBeadTypeStrandDefaults: true })).toBe(
      true,
    );
    expect(subBeadTypeInheritsBeadTypeStrandDefaults({})).toBe(true);
  });
});
