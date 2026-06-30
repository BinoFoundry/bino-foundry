import { describe, expect, it } from "vitest";

import {
  resolveStrandRenderConfigForBead,
  resolveStrandRenderConfigForType,
} from "./strand-render-profile";
import { TEST_STRAND_RENDER_CATALOGUE } from "./strand-render-test-catalogue";

describe("strand render profile", () => {
  it("resolves charm defaults from bead type metadata (not slug presets)", () => {
    const profile = resolveStrandRenderConfigForType("charm", TEST_STRAND_RENDER_CATALOGUE);
    expect(profile.rotationMode).toBe("radial-upright");
    expect(profile.anchorPreset).toBe("loop");
    expect(profile.forceRoundFootprint).toBe(false);
    expect(profile.provenance.rotationMode).toBe("beadType");
  });

  it("applies spacer occupancy from bead type defaults", () => {
    const profile = resolveStrandRenderConfigForType("spacer", TEST_STRAND_RENDER_CATALOGUE);
    expect(profile.strandOccupancy).toBeCloseTo(0.38, 2);
    expect(profile.provenance.strandOccupancy).toBe("beadType");
  });

  it("merges library override over type defaults when not inheriting", () => {
    const profile = resolveStrandRenderConfigForBead(
      {
        id: "gold-charm",
        name: "Gold",
        image: "",
        beadTypeId: "type-charm",
        beadTypeSlug: "charm",
        description: "",
        metadata: {
          useTypeStrandDefaults: false,
          strandRenderOverride: { visualScale: 1.05, verticalOffset: 0 },
        },
      },
      {
        ...TEST_STRAND_RENDER_CATALOGUE,
        beadTypes: [
          {
            id: "type-charm",
            slug: "charm",
            name: "Charm",
            description: "",
            metadata: { strandRender: { visualScale: 0.9 } },
          },
        ],
      },
    );
    expect(profile.visualScale).toBe(1.05);
    expect(profile.provenance.visualScale).toBe("beadOverride");
    expect(profile.provenance.rotationMode).toBe("system");
  });

  it("ignores bead override when inheriting type defaults", () => {
    const profile = resolveStrandRenderConfigForBead(
      {
        id: "charm-1",
        name: "Charm",
        image: "",
        beadTypeSlug: "charm",
        description: "",
        metadata: { useTypeStrandDefaults: true, strandRenderOverride: { visualScale: 2 } },
      },
      TEST_STRAND_RENDER_CATALOGUE,
    );
    expect(profile.visualScale).toBe(1);
    expect(profile.provenance.visualScale).toBe("beadType");
  });
});
