import { describe, expect, it } from "vitest";

import {
  resolveStrandRenderConfigForBead,
  resolveStrandRenderConfigForType,
} from "./strand-render-profile";
import { TEST_STRAND_RENDER_CATALOGUE } from "./strand-render-test-catalogue";

describe("strand render profile", () => {
  it("resolves charm defaults from bead type metadata (not slug presets)", () => {
    const profile = resolveStrandRenderConfigForType("charm", TEST_STRAND_RENDER_CATALOGUE);
    expect(profile.orientationMode).toBe("outward");
    expect(profile.anchorPreset).toBe("loop");
    expect(profile.forceRoundFootprint).toBe(false);
    expect(profile.provenance.orientationMode).toBe("beadType");
  });

  it("applies spacer contact width from bead type defaults", () => {
    const profile = resolveStrandRenderConfigForType("spacer", TEST_STRAND_RENDER_CATALOGUE);
    expect(profile.contactWidth).toBeCloseTo(1, 2);
    expect(profile.layoutMode).toBe("inline");
    expect(profile.provenance.contactWidth).toBe("beadType");
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
    expect(profile.provenance.orientationMode).toBe("system");
  });

  it("inherits bead type contact spacing when library override is empty", () => {
    const profile = resolveStrandRenderConfigForBead(
      {
        id: "crystal-1",
        name: "Crystal",
        image: "",
        beadTypeId: "type-crystal",
        beadTypeSlug: "crystal",
        description: "",
        metadata: {
          useTypeStrandDefaults: false,
          strandRenderOverride: {},
        },
      },
      {
        ...TEST_STRAND_RENDER_CATALOGUE,
        beadTypes: [
          {
            id: "type-crystal",
            slug: "crystal",
            name: "Crystal",
            description: "",
            metadata: {
              strandRender: {
                contactWidth: 1,
                contactOffset: -0.15,
              },
            },
          },
        ],
      },
    );
    expect(profile.contactOffset).toBeCloseTo(-0.15, 5);
    expect(profile.provenance.contactOffset).toBe("beadType");
  });

  it("applies library override contact spacing when override differs from type", () => {
    const profile = resolveStrandRenderConfigForBead(
      {
        id: "crystal-1",
        name: "Crystal",
        image: "",
        beadTypeId: "type-crystal",
        beadTypeSlug: "crystal",
        description: "",
        metadata: {
          useTypeStrandDefaults: false,
          strandRenderOverride: { contactOffset: 0 },
        },
      },
      {
        ...TEST_STRAND_RENDER_CATALOGUE,
        beadTypes: [
          {
            id: "type-crystal",
            slug: "crystal",
            name: "Crystal",
            description: "",
            metadata: {
              strandRender: {
                contactWidth: 1,
                contactOffset: -0.15,
              },
            },
          },
        ],
      },
    );
    expect(profile.contactOffset).toBe(0);
    expect(profile.provenance.contactOffset).toBe("beadOverride");
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

  it("hydrates stale placed snapshot from live catalogue library metadata", () => {
    const catalogue = {
      ...TEST_STRAND_RENDER_CATALOGUE,
      beadTypes: [
        {
          id: "type-crystal",
          slug: "crystal",
          name: "Crystal",
          description: "",
          metadata: { strandRender: { visualScale: 0.85, hangOffset: 0.2 } },
        },
      ],
      beadLibraries: [
        {
          id: "crystal-1",
          name: "Crystal",
          image: "",
          beadTypeId: "type-crystal",
          beadTypeSlug: "crystal",
          description: "",
          metadata: { useTypeStrandDefaults: true },
        },
      ],
    };

    const stalePlaced = {
      id: "crystal-1",
      name: "Crystal",
      image: "",
      beadTypeId: "type-crystal",
      beadTypeSlug: "crystal",
      description: "",
      metadata: {
        useTypeStrandDefaults: false,
        strandRenderOverride: { visualScale: 1.4 },
      },
    };

    const profile = resolveStrandRenderConfigForBead(stalePlaced, catalogue);
    expect(profile.visualScale).toBe(0.85);
    expect(profile.hangOffset).toBe(0.2);
    expect(profile.provenance.visualScale).toBe("beadType");
  });

  it("applies live type defaults when bead inherits after catalogue type update", () => {
    const profile = resolveStrandRenderConfigForBead(
      {
        id: "crystal-1",
        name: "Crystal",
        image: "",
        beadTypeId: "type-crystal",
        beadTypeSlug: "crystal",
        description: "",
        metadata: { useTypeStrandDefaults: true },
      },
      {
        ...TEST_STRAND_RENDER_CATALOGUE,
        beadTypes: [
          {
            id: "type-crystal",
            slug: "crystal",
            name: "Crystal",
            description: "",
            metadata: { strandRender: { visualScale: 0.72, verticalOffset: -0.1 } },
          },
        ],
      },
    );
    expect(profile.visualScale).toBe(0.72);
    expect(profile.verticalOffset).toBeCloseTo(-0.1);
    expect(profile.provenance.visualScale).toBe("beadType");
  });
});
