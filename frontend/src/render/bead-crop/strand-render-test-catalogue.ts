import type { BeadTypeEntry } from "@/types/beads";
import type { StrandRenderCatalogueContext } from "./strand-render-profile";

/** Bead type strand defaults aligned with migration seeds (tests only). */
export const TEST_STRAND_BEAD_TYPES: BeadTypeEntry[] = [
  {
    id: "type-crystal",
    slug: "crystal",
    name: "Crystal",
    description: "",
    placementMode: "replace",
    metadata: {
      strandRender: {
        strandOccupancy: 1,
        contactWidth: 1,
        leadingOverlap: 0,
        trailingOverlap: 0,
        hangOffset: 0,
        anchorPreset: "center",
        anchorX: 0.5,
        anchorY: 0.5,
        verticalOffset: 0,
        visualScale: 1,
        orientationMode: "outward",
        rotationOffsetDeg: 0,
        zPriority: 0,
        collisionPadding: 0,
        stringOcclusion: 1,
        forceRoundFootprint: true,
        preferStrandImageUrl: false,
      },
    },
  },
  {
    id: "type-charm",
    slug: "charm",
    name: "Charm",
    description: "",
    placementMode: "insert_between",
    metadata: {
      strandRender: {
        layoutMode: "dangling",
        strandOccupancy: 1,
        // Deliberately the original "buggy" seed — the pure occupancy model must ignore it.
        contactWidth: 0.08,
        leadingOverlap: 0.03,
        trailingOverlap: 0.03,
        hangOffset: 0,
        anchorPreset: "loop",
        anchorX: 0.5,
        anchorY: 0.08,
        verticalOffset: 0,
        visualScale: 1,
        orientationMode: "outward",
        rotationOffsetDeg: 0,
        zPriority: 10,
        collisionPadding: 0,
        stringOcclusion: 1,
        forceRoundFootprint: false,
        preferStrandImageUrl: false,
      },
    },
  },
  {
    id: "type-spacer",
    slug: "spacer",
    name: "Spacer",
    description: "",
    placementMode: "replace",
    metadata: {
      strandRender: {
        layoutMode: "inline",
        strandOccupancy: 1,
        contactWidth: 1,
        leadingOverlap: 0.02,
        trailingOverlap: 0.02,
        hangOffset: 0,
        anchorPreset: "center",
        anchorX: 0.5,
        anchorY: 0.5,
        verticalOffset: 0,
        visualScale: 1,
        orientationMode: "outward",
        rotationOffsetDeg: 0,
        zPriority: 0,
        collisionPadding: 0,
        stringOcclusion: 1,
        forceRoundFootprint: false,
        preferStrandImageUrl: true,
      },
    },
  },
];

export const TEST_STRAND_RENDER_CATALOGUE: StrandRenderCatalogueContext = {
  beadTypes: TEST_STRAND_BEAD_TYPES,
  strandRenderDefaults: null,
};
