import { describe, expect, it } from "vitest";

import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import { netContactLoopArcPx } from "@bino-foundry/shared/types";
import { TEST_STRAND_RENDER_CATALOGUE } from "@/render/bead-crop/strand-render-test-catalogue";
import { resolveStrandRenderConfigForBead } from "@/render/bead-crop";

import { strandUsedMm, wristCircumferenceMm, buildStrandFitMetrics } from "./capacity";
import { computeElasticBeadLayout } from "./strand-elastic-layout";
import {
  beadOccupancyArcPx,
  computeResolvedRingRadiusPx,
} from "./strand-ring-geometry";
import { computeWristRingRadiusPx, wristSizeBoundsFromCatalog } from "./strand-ring";
import { STRAND_LAYOUT_BASELINE_PX } from "./strand-viewport";

const BOUNDS = wristSizeBoundsFromCatalog([14, 15, 16, 17, 18, 19]);
const WRIST_CM = 16;

function mockPlaced(mm: number, slug: "crystal" | "charm" | "spacer", index: number): PlacedBead {
  const typeId =
    slug === "crystal" ? "type-crystal" : slug === "charm" ? "type-charm" : "type-spacer";
  return {
    position: index,
    bead: {
      id: `${slug}-${index}`,
      name: slug,
      beadTypeSlug: slug,
      beadTypeId: typeId,
      image: "",
    },
    size: {
      id: `offer-${slug}-${mm}-${index}`,
      offerKey: `k-${slug}-${mm}-${index}`,
      beadLibraryId: `${slug}-${index}`,
      beadSizeId: `size-${mm}`,
      sizeMm: mm,
      label: `${mm}mm`,
      unitPrice: 10,
    },
  };
}

function layoutOccupancy(beads: PlacedBead[]) {
  const scaleFactor = 1;
  const center = STRAND_LAYOUT_BASELINE_PX / 2;
  const sizeMmList = beads.map((b) => placedBeadSizeMm(b));
  const profiles = beads.map((b) =>
    resolveStrandRenderConfigForBead(b.bead, TEST_STRAND_RENDER_CATALOGUE),
  );
  // Visual extent is irrelevant to occupancy; use a stable stand-in for radius fit.
  const maxExtent = 40;
  const wristRadius = computeWristRingRadiusPx(center, WRIST_CM, scaleFactor, maxExtent, BOUNDS);
  const circumferencePx = 2 * Math.PI * wristRadius;
  const wristMm = wristCircumferenceMm(WRIST_CM);
  // Pure occupancy: sizeMm → arc, identical formula for every bead type. No contactWidth.
  const occupancy = beadOccupancyArcPx(sizeMmList, wristMm, circumferencePx);
  const resolved = computeResolvedRingRadiusPx({
    beadLayoutArcPx: occupancy.contactArcPx,
    leadingOverlapPx: occupancy.leadingOverlapPx,
    trailingOverlapPx: occupancy.trailingOverlapPx,
    wristRadiusPx: wristRadius,
    maxRadiusPx: wristRadius * 2,
    scaleFactor,
    pairGapPx: 0,
  });
  const packedCircumferencePx = 2 * Math.PI * resolved.radiusPx;
  const elastic = computeElasticBeadLayout(
    resolved.beadArcPx,
    packedCircumferencePx,
    undefined,
    0,
  );
  const netOccupiedPx = netContactLoopArcPx(
    resolved.beadArcPx,
    resolved.leadingOverlapPx,
    resolved.trailingOverlapPx,
  );
  const usedMm = strandUsedMm(beads);
  return {
    usedMm,
    wristMm,
    capacityPercent: buildStrandFitMetrics(WRIST_CM, beads).capacityPercent,
    netOccupiedPx,
    packedCircumferencePx,
    fillRatio: netOccupiedPx / packedCircumferencePx,
    elastic,
    contactArrays: occupancy,
    sizeMmList,
    profiles,
  };
}

describe("charm occupancy matches capacity (no layout collapse)", () => {
  it("crystals alone near capacity fill nearly the full circumference", () => {
    // 20 × 8mm = 160mm on a 16cm wrist → 100% capacity
    const crystals = Array.from({ length: 20 }, (_, i) => mockPlaced(8, "crystal", i));
    const layout = layoutOccupancy(crystals);
    expect(layout.usedMm).toBe(160);
    expect(layout.capacityPercent).toBe(100);
    expect(layout.fillRatio).toBeGreaterThan(0.98);
    expect(layout.elastic.isOverCapacity || layout.fillRatio >= 0.98).toBe(true);
  });

  it("inserting charms into a full crystal strand does not collapse the rendered arc", () => {
    // State A: 16 crystals (128mm) — under capacity, contiguous pack.
    const crystalsOnly = Array.from({ length: 16 }, (_, i) => mockPlaced(8, "crystal", i));
    const stateA = layoutOccupancy(crystalsOnly);
    expect(stateA.capacityPercent).toBe(80);
    expect(stateA.fillRatio).toBeGreaterThan(0.75);
    expect(stateA.fillRatio).toBeLessThan(0.85);

    // State B: replace 4 crystals with 4 charms of the same sizeMm (still 160mm / 100%).
    // Previously contactWidth 0.08 made charms occupy ~8% of visual width → tiny arc
    // while capacity still reported 100%.
    const mixed: PlacedBead[] = [
      ...Array.from({ length: 16 }, (_, i) => mockPlaced(8, "crystal", i)),
      ...Array.from({ length: 4 }, (_, i) => mockPlaced(8, "charm", 16 + i)),
    ];
    const stateB = layoutOccupancy(mixed);
    expect(stateB.usedMm).toBe(160);
    expect(stateB.capacityPercent).toBe(100);

    // Rendered arc must still fill the ring — charms must not compress the bracelet.
    expect(stateB.fillRatio).toBeGreaterThan(0.98);
    expect(stateB.netOccupiedPx).toBeGreaterThan(stateA.netOccupiedPx);

    // Per-bead: charm and crystal of equal sizeMm → equal arcs, EVEN THOUGH the charm's
    // catalogue contactWidth is the original "buggy" 0.08. The pure occupancy model ignores
    // contactWidth, so it can no longer shrink the arc or compress the bracelet.
    const crystalArc = stateB.contactArrays.contactArcPx[0]!;
    const charmArc = stateB.contactArrays.contactArcPx[16]!;
    expect(stateB.profiles[16]!.contactWidth).toBe(0.08);
    expect(charmArc).toBeCloseTo(crystalArc, 3);
  });

  it("spacers use the same capacity-mm occupancy model", () => {
    const beads: PlacedBead[] = [
      ...Array.from({ length: 10 }, (_, i) => mockPlaced(8, "crystal", i)),
      ...Array.from({ length: 10 }, (_, i) => mockPlaced(8, "spacer", 10 + i)),
    ];
    const layout = layoutOccupancy(beads);
    expect(layout.capacityPercent).toBe(100);
    expect(layout.fillRatio).toBeGreaterThan(0.98);
    expect(layout.contactArrays.contactArcPx[0]).toBeCloseTo(
      layout.contactArrays.contactArcPx[10]!,
      3,
    );
  });
});
