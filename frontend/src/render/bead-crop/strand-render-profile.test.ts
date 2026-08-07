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

  it("resolves placementMode from bead type column (not category name)", () => {
    expect(resolveStrandRenderConfigForType("crystal", TEST_STRAND_RENDER_CATALOGUE).placementMode).toBe(
      "replace",
    );
    expect(resolveStrandRenderConfigForType("charm", TEST_STRAND_RENDER_CATALOGUE).placementMode).toBe(
      "insert_between",
    );
    expect(resolveStrandRenderConfigForType("spacer", TEST_STRAND_RENDER_CATALOGUE).placementMode).toBe(
      "replace",
    );
    // Missing column → replace
    expect(
      resolveStrandRenderConfigForType("crystal", {
        beadTypes: [
          {
            id: "type-crystal",
            slug: "crystal",
            name: "Crystal",
            description: "",
          },
        ],
      }).placementMode,
    ).toBe("replace");
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
    // Legacy fraction −0.1 is coerced to −10% on parse.
    expect(profile.verticalOffset).toBeCloseTo(-10);
    expect(profile.provenance.visualScale).toBe("beadType");
  });

  it("resolves different visualScale for three inheriting types", () => {
    const catalogue = {
      ...TEST_STRAND_RENDER_CATALOGUE,
      beadTypes: [
        {
          id: "type-a",
          slug: "type-a",
          name: "A",
          description: "",
          metadata: { strandRender: { visualScale: 0.6, hangOffset: 0 } },
        },
        {
          id: "type-b",
          slug: "type-b",
          name: "B",
          description: "",
          metadata: { strandRender: { visualScale: 1.2, hangOffset: 0.3 } },
        },
        {
          id: "type-c",
          slug: "type-c",
          name: "C",
          description: "",
          metadata: { strandRender: { visualScale: 1.8, hangOffset: -0.2 } },
        },
      ],
    };

    const scales = (["type-a", "type-b", "type-c"] as const).map((typeId, i) =>
      resolveStrandRenderConfigForBead(
        {
          id: `bead-${i}`,
          name: `Bead ${i}`,
          image: "",
          beadTypeId: typeId,
          beadTypeSlug: typeId,
          description: "",
          metadata: { useTypeStrandDefaults: true },
        },
        catalogue,
      ),
    );

    expect(scales[0]!.visualScale).toBe(0.6);
    expect(scales[1]!.visualScale).toBe(1.2);
    expect(scales[2]!.visualScale).toBe(1.8);
    expect(scales[0]!.hangOffset).toBe(0);
    expect(scales[1]!.hangOffset).toBe(0.3);
    expect(scales[2]!.hangOffset).toBe(-0.2);
    expect(scales.map((s) => s.provenance.visualScale)).toEqual([
      "beadType",
      "beadType",
      "beadType",
    ]);
  });

  it("keeps identical look across types when beads have freezing overrides", () => {
    const catalogue = {
      ...TEST_STRAND_RENDER_CATALOGUE,
      beadTypes: [
        {
          id: "type-a",
          slug: "type-a",
          name: "A",
          description: "",
          metadata: { strandRender: { visualScale: 0.5 } },
        },
        {
          id: "type-b",
          slug: "type-b",
          name: "B",
          description: "",
          metadata: { strandRender: { visualScale: 2 } },
        },
      ],
    };
    const frozen = { useTypeStrandDefaults: false, strandRenderOverride: { visualScale: 1 } };
    const a = resolveStrandRenderConfigForBead(
      {
        id: "a",
        name: "A",
        image: "",
        beadTypeId: "type-a",
        beadTypeSlug: "type-a",
        description: "",
        metadata: frozen,
      },
      catalogue,
    );
    const b = resolveStrandRenderConfigForBead(
      {
        id: "b",
        name: "B",
        image: "",
        beadTypeId: "type-b",
        beadTypeSlug: "type-b",
        description: "",
        metadata: frozen,
      },
      catalogue,
    );
    expect(a.visualScale).toBe(1);
    expect(b.visualScale).toBe(1);
    expect(a.provenance.visualScale).toBe("beadOverride");
  });

  it("lets type settings override general (system) defaults", () => {
    const resolved = resolveStrandRenderConfigForBead(
      {
        id: "bead-1",
        name: "Bead",
        image: "",
        beadTypeId: "type-charm",
        beadTypeSlug: "charm",
        description: "",
        metadata: { useTypeStrandDefaults: true },
      },
      {
        strandRenderDefaults: {
          visualScale: 1,
          hangOffset: 0,
          balanceSpacing: true,
          orientationMode: "outward",
          layoutScale: 1,
          attachmentStyle: "inline",
          strandOccupancy: 1,
          contactWidth: 1,
          layoutMode: "inline",
          contactOffset: 0,
          spacingAdjustment: 0,
          leadingOverlap: 0,
          trailingOverlap: 0,
          anchorPreset: "center",
          anchorX: 0.5,
          anchorY: 0.5,
          verticalOffset: 0,
          rotationMode: "tangent",
          rotationOffsetDeg: 0,
          zPriority: 0,
          collisionPadding: 0,
          stringOcclusion: 1,
          forceRoundFootprint: true,
          preferStrandImageUrl: false,
        },
        beadTypes: [
          {
            id: "type-charm",
            slug: "charm",
            name: "Charm",
            description: "",
            metadata: {
              strandRender: {
                visualScale: 1.35,
                hangOffset: 0.4,
                balanceSpacing: false,
                orientationMode: "inward",
              },
            },
          },
        ],
      },
    );
    expect(resolved.visualScale).toBe(1.35);
    expect(resolved.hangOffset).toBe(0.4);
    expect(resolved.balanceSpacing).toBe(false);
    expect(resolved.orientationMode).toBe("inward");
    expect(resolved.provenance.visualScale).toBe("beadType");
    expect(resolved.provenance.hangOffset).toBe("beadType");
    expect(resolved.provenance.balanceSpacing).toBe("beadType");
    expect(resolved.provenance.orientationMode).toBe("beadType");
  });
});
