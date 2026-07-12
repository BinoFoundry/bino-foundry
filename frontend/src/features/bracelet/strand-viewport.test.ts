import { describe, expect, it } from "vitest";

import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import { getBeadSlotDimensions, resolveStrandRenderConfigForType } from "@/render/bead-crop";
import { TEST_STRAND_RENDER_CATALOGUE } from "@/render/bead-crop/strand-render-test-catalogue";

import { computeStrandPathLayout } from "./strand-path";
import { computeElasticBeadLayout } from "./strand-elastic-layout";
import {
  beadLayoutArcPx,
  computeResolvedRingRadiusPx,
} from "./strand-ring-geometry";
import { computeMaxRingRadiusPx, computeWristRingRadiusPx, wristSizeBoundsFromCatalog } from "./strand-ring";
import {
  computeLayoutCanvasSize,
  computeDefaultStrandZoom,
  computeStrandAutoFitScale,
  computeStrandCanvasFitBoost,
  computeStrandContentBounds,
  computeStrandViewScale,
  computeLayoutFitScale,
  computeTwinPreviewScale,
  measureStrandCanvasSize,
  shiftStrandLayoutToCanvasCenter,
  slotCentersOnRing,
  squareCanvasSizeForBounds,
  STRAND_LAYOUT_BASELINE_PX,
  viewportStrandZoomFactor,
} from "./strand-viewport";

describe("computeDefaultStrandZoom", () => {
  it("targets the same effective zoom for single and matching pair", () => {
    const single = computeDefaultStrandZoom({
      twinning: false,
      containerWidth: 1200,
      containerHeight: 800,
      isMobile: false,
      autoFitScale: 1,
    });
    const twin = computeDefaultStrandZoom({
      twinning: true,
      containerWidth: 1200,
      containerHeight: 800,
      isMobile: false,
      autoFitScale: 1,
    });
    expect(single).toBeCloseTo(twin, 5);
    expect(single).toBeGreaterThan(1.4);
    expect(single).toBeLessThan(1.75);
  });

  it("eases zoom down on mobile", () => {
    const laptop = computeDefaultStrandZoom({
      twinning: false,
      containerWidth: 1200,
      containerHeight: 800,
      isMobile: false,
      autoFitScale: 1,
    });
    const mobile = computeDefaultStrandZoom({
      twinning: false,
      containerWidth: 390,
      containerHeight: 700,
      isMobile: true,
      autoFitScale: 1,
    });
    expect(mobile).toBeLessThan(laptop);
  });

  it("compensates when auto-fit shrinks the layout", () => {
    const zoom = computeDefaultStrandZoom({
      twinning: false,
      containerWidth: 1200,
      containerHeight: 800,
      isMobile: false,
      autoFitScale: 0.8,
    });
    expect(zoom * 0.8).toBeGreaterThan(1.4);
  });
});

describe("viewportStrandZoomFactor", () => {
  it("boosts slightly on large desktops", () => {
    expect(
      viewportStrandZoomFactor(1680, 900, false, false),
    ).toBeGreaterThan(viewportStrandZoomFactor(1100, 800, false, false));
  });
});

describe("measureStrandCanvasSize", () => {
  it("uses the same per-strand canvas for single and matching pair", () => {
    const input = {
      containerWidth: 1200,
      containerHeight: 800,
      isMobile: false,
      libraryOpen: false,
    };
    expect(measureStrandCanvasSize({ ...input, twinning: false })).toBe(
      measureStrandCanvasSize({ ...input, twinning: true }),
    );
  });
});

describe("computeLayoutCanvasSize", () => {
  it("always returns the viewport budget (fixed workspace)", () => {
    expect(computeLayoutCanvasSize(400)).toBe(400);
    expect(computeLayoutCanvasSize(520)).toBe(520);
  });
});

describe("computeStrandCanvasFitBoost", () => {
  it("returns 1 when content fits", () => {
    expect(computeStrandCanvasFitBoost(380, 400)).toBe(1);
  });

  it("shrinks when content exceeds the fixed canvas", () => {
    expect(computeStrandCanvasFitBoost(500, 400)).toBeCloseTo(0.8, 5);
  });
});

describe("computeStrandAutoFitScale", () => {
  it("downscales when layout canvas exceeds viewport budget", () => {
    expect(computeStrandAutoFitScale(400, 520)).toBeCloseTo(400 / 520, 5);
  });

  it("never upscales above 1", () => {
    expect(computeStrandAutoFitScale(500, 400)).toBe(1);
  });

  it("fits both twin strands within the preview width", () => {
    const scale = computeStrandAutoFitScale(280, 320, {
      twinning: true,
      viewportWidthPx: 600,
    });
    expect(scale * 320 * 2 + 12).toBeLessThanOrEqual(600);
    expect(scale).toBeLessThan(1);
  });
});

describe("computeTwinPreviewScale", () => {
  it("returns 1 when twin auto-fit matches the single-strand base", () => {
    expect(computeTwinPreviewScale(1, 1)).toBe(1);
    expect(computeTwinPreviewScale(0.8, 0.8)).toBe(1);
  });

  it("derives a temporary twin fit multiplier from auto-fit values", () => {
    expect(computeTwinPreviewScale(1, 0.74)).toBeCloseTo(0.74, 5);
  });
});

describe("computeLayoutFitScale", () => {
  it("combines auto-fit with optional twin preview multiplier", () => {
    expect(
      computeLayoutFitScale({ autoFitScale: 1, twinPreviewScale: 0.74 }),
    ).toBeCloseTo(0.74, 5);
  });
});

describe("computeStrandAutoFitScale twin guard", () => {
  it("never returns a negative twin width fit when viewport width is zero", () => {
    const scale = computeStrandAutoFitScale(500, 500, {
      twinning: true,
      viewportWidthPx: 0,
    });
    expect(scale).toBeGreaterThanOrEqual(0);
    expect(scale).toBeLessThanOrEqual(1);
  });
});

describe("computeStrandViewScale", () => {
  const userZoom = 1.55;
  const baseAutoFit = 1;

  it("applies twinPreviewScale as a render-only multiplier", () => {
    const singleViewScale = computeStrandViewScale({
      autoFitScale: baseAutoFit,
      userZoom,
    });

    const twinViewScale = computeStrandViewScale({
      autoFitScale: baseAutoFit,
      userZoom,
      twinPreviewScale: 0.74,
    });

    expect(twinViewScale).toBeCloseTo(singleViewScale * 0.74, 5);
  });

  it("single-strand view scale unchanged when twin preview is 1", () => {
    const singleViewScale = computeStrandViewScale({
      autoFitScale: baseAutoFit,
      userZoom: 1.8,
    });

    const restored = computeStrandViewScale({
      autoFitScale: baseAutoFit,
      userZoom: 1.8,
      twinPreviewScale: 1,
    });
    expect(restored).toBe(singleViewScale);
  });
});

describe("computeStrandContentBounds", () => {
  it("includes ring stroke half-width in bounds", () => {
    const bounds = computeStrandContentBounds([], 100, 200, 4);
    expect(bounds.minX).toBe(96);
    expect(bounds.maxX).toBe(304);
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
  const layoutArcs = prelimDims.map((d, i) =>
    beadLayoutArcPx(
      d,
      scaleFactor,
      resolveStrandRenderConfigForType(beads[i]?.bead.beadTypeSlug, TEST_STRAND_RENDER_CATALOGUE),
    ),
  );
  const resolved = computeResolvedRingRadiusPx({
    beadLayoutArcPx: layoutArcs,
    wristRadiusPx: wristRadius,
    maxRadiusPx,
    scaleFactor,
    pairGapPx: 0,
  });
  const circumference = 2 * Math.PI * resolved.radiusPx;
  const pathLayout = computeStrandPathLayout({
    beads: beads.map((_, i) => ({ index: i, beadMm: resolved.beadArcPx[i] })),
    layoutCircumferenceMm: circumference,
    centerX: center,
    centerY: center,
    radius: resolved.radiusPx,
    minGapPx: 0,
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
    expect(Math.abs(bboxCx - center)).toBeGreaterThan(0.4);

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
