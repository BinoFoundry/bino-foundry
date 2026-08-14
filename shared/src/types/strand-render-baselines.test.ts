import { describe, expect, it } from "vitest";

import {
  inferStrandRenderDefaultsForType,
  isExperimentalSubTypeStrandBaseline,
  isReplaceableSubBeadTypeName,
  recommendedSubTypeStrandBaseline,
  resolveStrandRenderConfig,
  resolveSubBeadTypeClientHint,
  STRAND_RENDER_SUBTYPE_RECOMMENDED,
  strandSubTypeClientCopy,
} from "./index.js";

describe("sensible strand render baselines", () => {
  it("infers dangling charm vs round crystal vs spacer defaults", () => {
    const crystal = inferStrandRenderDefaultsForType({ slug: "crystal", name: "Crystal" });
    expect(crystal.layoutMode).toBe("inline");
    expect(crystal.anchorPreset).toBe("center");
    expect(crystal.visualScale).toBe(1);
    expect(crystal.contactWidth).toBe(1);
    expect(crystal.forceRoundFootprint).toBe(true);

    const charm = inferStrandRenderDefaultsForType({ slug: "charm", name: "Charm" });
    expect(charm.layoutMode).toBe("dangling");
    expect(charm.anchorPreset).toBe("loop");
    expect(charm.visualScale).toBe(1);
    expect(charm.verticalOffset).toBe(0);

    const spacer = inferStrandRenderDefaultsForType({ slug: "spacer", name: "Spacer" });
    expect(spacer.layoutMode).toBe("inline");
    expect(spacer.forceRoundFootprint).toBe(false);
  });

  it("detects only known experimental sub-type fingerprints", () => {
    expect(
      isExperimentalSubTypeStrandBaseline("crystal-general", {
        layoutScale: 0.4,
        contactWidth: 1.8,
      }),
    ).toBe(true);
    expect(
      isExperimentalSubTypeStrandBaseline("crystal-general", {
        layoutScale: 1,
        contactWidth: 1,
      }),
    ).toBe(false);
    expect(
      isExperimentalSubTypeStrandBaseline("fixed", { visualScale: 5, layoutScale: 0.2 }),
    ).toBe(true);
    expect(
      isExperimentalSubTypeStrandBaseline("hanging", { contactWidth: -0.5 }),
    ).toBe(true);
    expect(
      isExperimentalSubTypeStrandBaseline("dangling", {
        layoutMode: "dangling",
        verticalOffset: -25,
        anchorPreset: "loop",
      }),
    ).toBe(true);
    expect(
      isExperimentalSubTypeStrandBaseline("dangling", {
        layoutMode: "dangling",
        verticalOffset: 0,
        anchorPreset: "loop",
      }),
    ).toBe(false);
  });

  it("recommends fixed charms as inline/center and dangling as loop hang", () => {
    expect(recommendedSubTypeStrandBaseline("fixed")?.layoutMode).toBe("inline");
    expect(recommendedSubTypeStrandBaseline("fixed")?.anchorPreset).toBe("center");
    expect(recommendedSubTypeStrandBaseline("dangling")?.layoutMode).toBe("dangling");
    expect(recommendedSubTypeStrandBaseline("dangling")?.verticalOffset).toBe(0);
    expect(STRAND_RENDER_SUBTYPE_RECOMMENDED.drop?.anchorPreset).toBe("loop");
  });

  it("exposes client-facing dangling vs drop copy without changing slugs", () => {
    expect(strandSubTypeClientCopy("dangling")?.suggestedName).toBe("Dangling (on cord)");
    expect(strandSubTypeClientCopy("dangling")?.description).toMatch(/hanging ring/i);
    expect(strandSubTypeClientCopy("drop")?.suggestedName).toBe("Drop (lower hang)");
    expect(strandSubTypeClientCopy("fixed")?.suggestedName).toBe("Fixed (on strand)");
    expect(isReplaceableSubBeadTypeName("dangling", "Dangling")).toBe(true);
    expect(isReplaceableSubBeadTypeName("dangling", "Custom Charm Hang")).toBe(false);
    expect(resolveSubBeadTypeClientHint({ slug: "drop", description: "" })).toMatch(/lower/i);
    expect(resolveSubBeadTypeClientHint({ slug: "drop", description: "Client note" })).toBe(
      "Client note",
    );
  });

  it("resolves inheritance: bead override wins; missing levels fall through", () => {
    const withOverride = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1 },
      beadTypeDefaults: { visualScale: 1.1, layoutMode: "inline" },
      subBeadTypeOverride: { verticalOffset: -25, layoutMode: "dangling" },
      inheritSubBeadTypeFromBeadType: false,
      beadOverride: { visualScale: 1.2 },
      inheritBeadFromSubBeadType: false,
    });
    expect(withOverride.visualScale).toBe(1.2);
    expect(withOverride.layoutMode).toBe("dangling");
    expect(withOverride.provenance.visualScale).toBe("beadOverride");
    expect(withOverride.provenance.layoutMode).toBe("subBeadType");

    const inheritAll = resolveStrandRenderConfig({
      systemDefaults: { visualScale: 1, layoutMode: "inline" },
      beadTypeDefaults: { visualScale: 1, contactWidth: 1 },
      subBeadTypeOverride: { visualScale: 0.8 },
      inheritSubBeadTypeFromBeadType: true,
      beadOverride: { visualScale: 1.4 },
      inheritBeadFromSubBeadType: true,
    });
    expect(inheritAll.visualScale).toBe(1);
    expect(inheritAll.provenance.visualScale).toBe("beadType");
    expect(inheritAll.imageSizeAdjust).toBe(1);
    expect(inheritAll.contactWidth).toBe(1);
    expect(inheritAll.provenance.contactWidth).toBe("beadType");
  });
});
