import { describe, expect, it } from "vitest";

import { BEAD_CROP_CONFIG_V2, type BeadCropConfigV2 } from "@bino-foundry/shared/types";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";

import {
  buildNormalizedRegenQueue,
  buildNormalizedRegenWorkItems,
  formatEtaMs,
} from "./normalized-asset-regen";
import {
  assertRegenSummaryConsistency,
  isGroupReferenceBead,
  regenRecordFromExport,
  tallyRegenRecords,
} from "./normalized-regen-pipeline";

function cropConfig(visiblePx = 60): BeadCropConfigV2 {
  return {
    version: BEAD_CROP_CONFIG_V2,
    imageWidth: 100,
    imageHeight: 100,
    originalUrl: "https://example.com/original.png",
    points: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.5, y: 0.8 },
    ],
    scale: 1,
    physicalMetrics: {
      visibleWidthPx: visiblePx,
      visibleHeightPx: visiblePx,
      referenceDiameterPx: visiblePx,
    },
    updatedAt: 1,
  };
}

function library(id: string, beadTypeId: string, visiblePx = 60): BeadLibraryEntry {
  return {
    id,
    name: id,
    image: "",
    originalImage: "https://example.com/original.png",
    beadTypeId,
    description: "",
    cropConfig: cropConfig(visiblePx),
    cropStatus: "ready",
  };
}

function offer(
  libraryId: string,
  sizeMm: number,
  extra?: Partial<BeadLibrarySizeOffer>,
): BeadLibrarySizeOffer {
  return {
    id: `${libraryId}-${sizeMm}`,
    beadLibraryId: libraryId,
    beadSizeId: `size-${sizeMm}`,
    sizeMm,
    label: `${sizeMm} mm`,
    unitPrice: 1,
    offerKey: `${libraryId}-${sizeMm}`,
    ...extra,
  };
}

describe("normalized asset regen", () => {
  const libraries = [library("alpha", "crystal"), library("beta", "charm")];
  const offers = [offer("alpha", 6), offer("alpha", 8), offer("beta", 6)];
  const beadSizes = [
    { id: "s6", sizeMm: 6, label: "6 mm", groupReferenceDiameterPx: 400 },
    { id: "s8", sizeMm: 8, label: "8 mm", groupReferenceDiameterPx: 500 },
  ];
  const beadTypes = [
    { id: "crystal", slug: "crystal", name: "Crystal", description: "" },
    { id: "charm", slug: "charm", name: "Charm", description: "" },
  ];

  it("builds all-scope work items for every enabled size junction", () => {
    const items = buildNormalizedRegenWorkItems(libraries, offers, beadSizes, beadTypes, {
      scope: "all",
      force: true,
    });
    expect(items).toHaveLength(3);
  });

  it("includes every junction in the queue even when export is not stale", () => {
    const refLibrary = library("ref-bead", "crystal", 400);
    const freshOffer = offer("ref-bead", 6, {
      normalizedProcessedImageUrl: "https://example.com/norm.webp",
      normalizedVisibleDiameterPx: 400,
      needsNormalizedReexport: false,
      assetVisibleDiameterPx: 400,
      updatedAt: new Date().toISOString(),
    });
    const queue = buildNormalizedRegenQueue(
      [refLibrary],
      [freshOffer],
      beadSizes,
      beadTypes,
      { scope: "all", force: false },
    );
    expect(queue).toHaveLength(1);
    expect(queue[0]?.isGroupReference).toBe(true);
    expect(queue[0]?.needsExport).toBe(false);
  });

  it("filters by bead size", () => {
    const items = buildNormalizedRegenWorkItems(libraries, offers, beadSizes, beadTypes, {
      scope: "bead-size",
      sizeMm: 8,
      force: true,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.libraryId).toBe("alpha");
    expect(items[0]?.sizeMm).toBe(8);
  });

  it("filters by category", () => {
    const items = buildNormalizedRegenWorkItems(libraries, offers, beadSizes, beadTypes, {
      scope: "category",
      beadTypeId: "charm",
      force: true,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.libraryId).toBe("beta");
  });

  it("filters selected libraries", () => {
    const items = buildNormalizedRegenWorkItems(libraries, offers, beadSizes, beadTypes, {
      scope: "selected",
      libraryIds: ["beta"],
      force: true,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.libraryId).toBe("beta");
  });

  it("formats eta for display", () => {
    expect(formatEtaMs(45000)).toBe("~45s");
    expect(formatEtaMs(125000)).toBe("~2m 5s");
    expect(formatEtaMs(null)).toBe("—");
  });
});

describe("normalized regen pipeline consistency", () => {
  it("detects group reference beads by visible footprint", () => {
    expect(isGroupReferenceBead(400, 400)).toBe(true);
    expect(isGroupReferenceBead(350, 400)).toBe(false);
  });

  it("asserts summary totals reconcile", () => {
    const records = [
      regenRecordFromExport({
        libraryId: "a",
        libraryName: "Alpha",
        sizeMm: 6,
        offerId: "a-6",
        status: "SAVED",
        reason: "Bitmap regenerated",
        pipelineStep: "save-asset",
        assetVisibleDiameterPx: 350,
        groupReferenceDiameterPx: 400,
        isGroupReference: false,
      }),
      regenRecordFromExport({
        libraryId: "b",
        libraryName: "Beta",
        sizeMm: 6,
        offerId: "b-6",
        status: "REFERENCE",
        reason: "Largest visible bead",
        pipelineStep: "assign-reference",
        assetVisibleDiameterPx: 400,
        groupReferenceDiameterPx: 400,
        isGroupReference: true,
      }),
    ];

    const summary = assertRegenSummaryConsistency(records, {
      sizeGroupsProcessed: 1,
      factorsRefreshed: 2,
    });
    expect(summary.beadsProcessed).toBe(2);
    expect(summary.saved + summary.reference).toBe(2);
    expect(tallyRegenRecords(records).beadsProcessed).toBe(2);
  });

  it("throws when totals do not reconcile", () => {
    const records = [
      regenRecordFromExport({
        libraryId: "a",
        libraryName: "Alpha",
        sizeMm: 6,
        offerId: "a-6",
        status: "SAVED",
        reason: "Bitmap regenerated",
        pipelineStep: "save-asset",
        assetVisibleDiameterPx: 350,
        groupReferenceDiameterPx: 400,
        isGroupReference: false,
      }),
    ];
    // @ts-expect-error — simulate corrupt record missing from tally
    records.push({ libraryId: "orphan", libraryName: "Orphan", sizeMm: 8, offerId: null, status: undefined as never, reason: "", pipelineStep: "", assetVisibleDiameterPx: null, groupReferenceDiameterPx: null, isGroupReference: false });

    expect(() => assertRegenSummaryConsistency(records)).toThrow(/inconsistent/i);
  });
});
