import { describe, expect, it } from "vitest";

import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import {
  beadContactArcPxFromSizing,
  beadContactLayoutArrays,
  computeResolvedRingRadiusPx,
} from "./strand-ring-geometry";
import { computeElasticBeadLayout, adjacentIndexAngleDeltaRad } from "./strand-elastic-layout";
import { resolveBeadSlotSizing } from "@/render/bead-crop";
import { TEST_STRAND_RENDER_CATALOGUE } from "@/render/bead-crop/strand-render-test-catalogue";
import { computeWristRingRadiusPx, wristSizeBoundsFromCatalog } from "./strand-ring";
import { STRAND_LAYOUT_BASELINE_PX } from "./strand-viewport";

const BOUNDS = wristSizeBoundsFromCatalog([14, 15, 16, 17, 18, 19]);

function mockPlaced(mm: number): PlacedBead {
  return {
    position: 0,
    bead: { id: "b", name: "Test", beadTypeSlug: "crystal", beadTypeId: "t", image: "" },
    size: {
      id: `offer-${mm}`,
      offerKey: `k-${mm}`,
      beadLibraryId: "b",
      beadSizeId: `size-${mm}`,
      sizeMm: mm,
      label: `${mm}mm`,
      unitPrice: 10,
    },
  };
}

function adjacentCentreArcPx(
  angles: number[],
  arcPx: number[],
  radiusPx: number,
  index: number,
): number {
  const delta = adjacentIndexAngleDeltaRad(angles, index);
  return delta * radiusPx;
}

function layoutCentreDistance(
  beads: PlacedBead[],
  contactOffset: number,
  wristCm = 16,
  contactWidth = 1,
) {
  const scaleFactor = 1;
  const canvasSize = STRAND_LAYOUT_BASELINE_PX;
  const center = canvasSize / 2;
  const sizingResults = beads.map((b) =>
    resolveBeadSlotSizing(b, placedBeadSizeMm(b), scaleFactor, TEST_STRAND_RENDER_CATALOGUE),
  );
  const profiles = beads.map(() => ({
    contactWidth,
    contactOffset,
    spacingAdjustment: 0,
    leadingOverlap: 0,
    trailingOverlap: 0,
    collisionPadding: 0,
  }));
  const contactArrays = beadContactLayoutArrays(sizingResults, profiles, scaleFactor);
  const maxExtent = Math.max(...sizingResults.map((s) => Math.max(s.dimensions.width, s.dimensions.height)));
  const wristRadius = computeWristRingRadiusPx(center, wristCm, scaleFactor, maxExtent, BOUNDS);
  const resolved = computeResolvedRingRadiusPx({
    beadLayoutArcPx: contactArrays.contactArcPx,
    leadingOverlapPx: contactArrays.leadingOverlapPx,
    trailingOverlapPx: contactArrays.trailingOverlapPx,
    wristRadiusPx: wristRadius,
    maxRadiusPx: wristRadius * 2,
    scaleFactor,
    pairGapPx: 0,
  });
  const circumference = 2 * Math.PI * resolved.radiusPx;
  const elastic = computeElasticBeadLayout(
    resolved.beadArcPx,
    circumference,
    undefined,
    0,
    {
      leadingPx: resolved.leadingOverlapPx,
      trailingPx: resolved.trailingOverlapPx,
    },
  );
  return {
    contactArcPx: contactArrays.contactArcPx,
    centreArcPx: adjacentCentreArcPx(elastic.angles, resolved.beadArcPx, resolved.radiusPx, 0),
    isOverCapacity: elastic.isOverCapacity,
    resolved,
    elastic,
  };
}

describe("contact width / adjustment effect on neighbour distance", () => {
  it("changes contact arc px when contact adjustment moves from 0 to -0.2", () => {
    const placed = mockPlaced(8);
    const sizing = resolveBeadSlotSizing(placed, 8, 1, TEST_STRAND_RENDER_CATALOGUE);
    const neutral = beadContactArcPxFromSizing(sizing, {
      contactWidth: 1,
      contactOffset: 0,
      spacingAdjustment: 0,
      leadingOverlap: 0,
      trailingOverlap: 0,
      collisionPadding: 0,
    });
    const tightened = beadContactArcPxFromSizing(sizing, {
      contactWidth: 1,
      contactOffset: -0.2,
      spacingAdjustment: 0,
      leadingOverlap: 0,
      trailingOverlap: 0,
      collisionPadding: 0,
    });
    expect(tightened.contactArcPx).toBeLessThan(neutral.contactArcPx);
    expect(tightened.contactArcPx / neutral.contactArcPx).toBeCloseTo(0.8, 3);
  });

  it("changes adjacent centre-to-centre distance when contact width moves from 0 to -0.2", () => {
    const beads = [mockPlaced(8), mockPlaced(8), mockPlaced(8)];
    const neutral = layoutCentreDistance(beads, 0, 16, 0);
    const tightened = layoutCentreDistance(beads, 0, 16, -0.2);
    expect(tightened.contactArcPx[0]).toBeLessThan(neutral.contactArcPx[0]!);
    expect(tightened.centreArcPx).toBeLessThan(neutral.centreArcPx);
    expect(tightened.isOverCapacity).toBe(false);
  });

  it("changes adjacent centre-to-centre distance for identical crystals", () => {
    const beads = [mockPlaced(8), mockPlaced(8), mockPlaced(8)];
    const neutral = layoutCentreDistance(beads, 0);
    const tightened = layoutCentreDistance(beads, -0.2);
    expect(tightened.contactArcPx[0]).toBeLessThan(neutral.contactArcPx[0]!);
    expect(tightened.centreArcPx).toBeLessThan(neutral.centreArcPx);
    expect(tightened.isOverCapacity).toBe(false);
  });

  it("changes spacing on a full bracelet (many beads)", () => {
    const beads = Array.from({ length: 18 }, () => mockPlaced(8));
    const neutral = layoutCentreDistance(beads, 0);
    const tightened = layoutCentreDistance(beads, -0.15);
    expect(tightened.centreArcPx).toBeLessThan(neutral.centreArcPx);
    expect(tightened.isOverCapacity).toBe(false);
  });
});
