import { describe, expect, it } from "vitest";

import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import { getBeadSlotDimensions } from "@/render/bead-crop";

import { computeStrandPathLayout } from "./strand-path";
import { computeElasticBeadLayout } from "./strand-elastic-layout";
import {
  beadLayoutArcPx,
  computeResolvedRingRadiusPx,
} from "./strand-ring-geometry";
import { computeMaxRingRadiusPx, computeWristRingRadiusPx, wristSizeBoundsFromCatalog } from "./strand-ring";
import {
  computeStrandAutoFitScale,
  computeStrandContentBounds,
  measureStrandCanvasSize,
  shiftStrandLayoutToCanvasCenter,
  slotCentersOnRing,
  squareCanvasSizeForBounds,
  STRAND_LAYOUT_BASELINE_PX,
} from "./strand-viewport";

describe("measureStrandCanvasSize", () => {
  it("uses more of a large desktop viewport than the old 440px cap", () => {
    const size = measureStrandCanvasSize({
      containerWidth: 1400,
      containerHeight: 900,
      isMobile: false,
      twinning: false,
      libraryOpen: true,
    });
    expect(size).toBeGreaterThan(440);
    expect(size).toBeLessThanOrEqual(760);
  });
});

describe("computeStrandAutoFitScale", () => {
  it("downscales when layout canvas exceeds viewport budget", () => {
    expect(computeStrandAutoFitScale(400, 520)).toBeCloseTo(400 / 520, 5);
  });

  it("never upscales above 1", () => {
    expect(computeStrandAutoFitScale(500, 400)).toBe(1);
  });
});

describe("squareCanvasSizeForBounds", () => {
  it("includes padding on all sides", () => {
    const side = squareCanvasSizeForBounds(
      { minX: 10, maxX: 110, minY: 20, maxY: 120 },
      16,
    );
    expect(side).toBe(132);
  });
});

function mockPlaced(mm: number, slug = "crystal"): PlacedBead {
  return {
    position: 0,
    bead: { id: "b", name: "Test", beadTypeSlug: slug, beadTypeId: "t", image: "" },
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

function layoutMixedSizesOnRing(
  sizesMm: number[],
  canvasSize = 400,
  slugFor = (_mm: number) => "crystal" as string,
) {
  const beads = sizesMm.map((mm) => mockPlaced(mm, slugFor(mm)));
  const center = canvasSize / 2;
  const scaleFactor = canvasSize / STRAND_LAYOUT_BASELINE_PX;
  const bounds = wristSizeBoundsFromCatalog([14, 15, 16, 17, 18, 19]);
  const prelimDims = beads.map((b) =>
    getBeadSlotDimensions(b, placedBeadSizeMm(b), scaleFactor),
  );
  const maxExtent = Math.max(...prelimDims.map((d) => Math.max(d.width, d.height)));
  const wristRadius = computeWristRingRadiusPx(center, 16, scaleFactor, maxExtent, bounds);
  const maxRadiusPx = computeMaxRingRadiusPx(center, scaleFactor, maxExtent);
  const layoutArcs = prelimDims.map((d) => beadLayoutArcPx(d, scaleFactor));
  const resolved = computeResolvedRingRadiusPx({
    beadLayoutArcPx: layoutArcs,
    wristRadiusPx: wristRadius,
    maxRadiusPx,
    scaleFactor,
  });
  const circumference = 2 * Math.PI * resolved.radiusPx;
  const pathLayout = computeStrandPathLayout({
    beads: beads.map((_, i) => ({ index: i, beadMm: resolved.beadArcPx[i] })),
    layoutCircumferenceMm: circumference,
    centerX: center,
    centerY: center,
    radius: resolved.radiusPx,
    minGapPx: resolved.pairGapPx,
  });
  const slots = pathLayout.map((path, i) => ({
    x: path.x,
    y: path.y,
    width: prelimDims[i]!.width,
    height: prelimDims[i]!.height,
  }));
  return { center, radius: resolved.radiusPx, slots };
}

describe("shiftStrandLayoutToCanvasCenter", () => {
  it("keeps mixed-size bead centers on the ring after canvas recentering", () => {
    const { center, radius, slots } = layoutMixedSizesOnRing([0.5, 2.5, 4, 6, 8, 10]);
    const bounds = computeStrandContentBounds(slots, radius, center);
    const effectiveCanvas = squareCanvasSizeForBounds(bounds, 24);
    const targetCenter = effectiveCanvas / 2;

    const bboxCx = (bounds.minX + bounds.maxX) / 2;
    expect(Math.abs(bboxCx - center)).toBeGreaterThan(0.5);

    const shifted = shiftStrandLayoutToCanvasCenter({
      ringCenter: center,
      targetCenter,
      slots,
    });

    expect(
      slotCentersOnRing(shifted.slots, shifted.ringCenter, shifted.ringCenter, radius),
    ).toBe(true);

    const distances = shifted.slots.map((s) =>
      Math.hypot(s.x - shifted.ringCenter, s.y - shifted.ringCenter),
    );
    expect(new Set(distances.map((d) => d.toFixed(2))).size).toBe(1);
  });

  it("aligns tiny and large beads on the same centerline (2mm + 8mm + charm)", () => {
    const { center, radius, slots } = layoutMixedSizesOnRing(
      [2, 8, 10],
      400,
      (mm) => (mm >= 10 ? "charm" : "crystal"),
    );
    const bounds = computeStrandContentBounds(slots, radius, center);
    const shifted = shiftStrandLayoutToCanvasCenter({
      ringCenter: center,
      targetCenter: squareCanvasSizeForBounds(bounds, 24) / 2,
      slots,
    });
    expect(
      slotCentersOnRing(shifted.slots, shifted.ringCenter, shifted.ringCenter, radius),
    ).toBe(true);
  });
});
