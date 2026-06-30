import { describe, expect, it } from "vitest";

import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import { getBeadSlotDimensions, resolveStrandRenderConfigForType } from "@/render/bead-crop";
import { TEST_STRAND_RENDER_CATALOGUE } from "@/render/bead-crop/strand-render-test-catalogue";

import { computeElasticBeadLayout } from "./strand-elastic-layout";
import {
  adjacentPairsMeetGap,
  beadLayoutArcPx,
  beadSectorsOverlap,
  computeResolvedRingRadiusPx,
  resolveStrandRingLayout,
  scaledBeadSpacingPx,
} from "./strand-ring-geometry";
import { computeMaxRingRadiusPx, computeWristRingRadiusPx, wristSizeBoundsFromCatalog } from "./strand-ring";

const BOUNDS = wristSizeBoundsFromCatalog([14, 15, 16, 17, 18, 19]);

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

function layoutForWrist(
  wristCm: number,
  beads: PlacedBead[],
  scaleFactor = 1,
  canvasCenter = 200,
) {
  const canvasSize = canvasCenter * 2;
  const layout = resolveStrandRingLayout({
    placed: beads,
    wristSizeCm: wristCm,
    wristSizeBounds: BOUNDS,
    canvasSize,
    guideSizeMm: 8,
    beadScaleBoost: scaleFactor,
    renderCatalogue: TEST_STRAND_RENDER_CATALOGUE,
  });
  if (!layout) throw new Error("expected layout");
  const resolved = layout.resolved;
  const pairGapPx = resolved.pairGapPx;
  const circumferencePx = 2 * Math.PI * resolved.radiusPx;
  const elastic = computeElasticBeadLayout(
    resolved.beadArcPx,
    circumferencePx,
    undefined,
    resolved.pairGapPx,
  );
  return { resolved, elastic, pairGapPx, scaleFactor: layout.scaleFactor, layout };
}

function assertCleanLayout(
  wristCm: number,
  beads: PlacedBead[],
  scaleFactor = 1,
  canvasCenter = 200,
) {
  const { resolved, elastic, pairGapPx } = layoutForWrist(wristCm, beads, scaleFactor, canvasCenter);
  const circumferencePx = 2 * Math.PI * resolved.radiusPx;
  const totalArcPx = resolved.beadArcPx.reduce((sum, arc) => sum + arc, 0);
  const closedLoop =
    elastic.isOverCapacity || totalArcPx >= circumferencePx * (1 - 1e-4);
  expect(beadSectorsOverlap(elastic.angles, elastic.arcSpans, 1, closedLoop)).toBe(false);
  expect(
    adjacentPairsMeetGap(
      elastic.angles,
      resolved.beadArcPx,
      resolved.radiusPx,
      pairGapPx,
      closedLoop,
    ),
  ).toBe(true);
  return resolved;
}

describe("computeResolvedRingRadiusPx", () => {
  it("expands beyond wrist baseline when large rendered beads need more arc", () => {
    const beads = Array.from({ length: 12 }, () => mockPlaced(12, "charm"));
    const { resolved, layout } = layoutForWrist(16, beads, 1.35);
    expect(resolved.radiusPx).toBeGreaterThanOrEqual(layout.wristRadiusPx);
    expect(resolved.expanded).toBe(true);
    assertCleanLayout(16, beads, 1.35);
  });

  it("never clamps below overlap-free radius when layout exceeds canvas", () => {
    const beads = Array.from({ length: 15 }, () => mockPlaced(12));
    const scaleFactor = 1;
    const center = 80;
    const prelimDims = beads.map((b) =>
      getBeadSlotDimensions(b, placedBeadSizeMm(b), scaleFactor),
    );
    const layoutArcs = prelimDims.map((d, i) =>
      beadLayoutArcPx(
        d,
        scaleFactor,
        resolveStrandRenderConfigForType(beads[i]?.bead.beadTypeSlug, TEST_STRAND_RENDER_CATALOGUE),
      ),
    );
    const maxExtent = Math.max(...prelimDims.map((d) => Math.max(d.width, d.height)));
    const wristRadius = computeWristRingRadiusPx(center, 14, scaleFactor, maxExtent, BOUNDS);
    const maxRadius = computeMaxRingRadiusPx(center, scaleFactor, maxExtent);
    const resolved = computeResolvedRingRadiusPx({
      beadLayoutArcPx: layoutArcs,
      wristRadiusPx: wristRadius,
      maxRadiusPx: maxRadius,
      scaleFactor,
    });
    const neededRadius =
      (layoutArcs.reduce((s, a) => s + a, 0) + beads.length * resolved.pairGapPx) / (2 * Math.PI);
    expect(resolved.radiusPx).toBeGreaterThanOrEqual(neededRadius - 0.5);
    expect(resolved.radiusPx).toBeGreaterThan(maxRadius);
    expect(resolved.isVisualOverCanvas).toBe(true);
    assertCleanLayout(14, beads, scaleFactor, center);
  });

  it("keeps distinct wrist baselines for 14cm vs 19cm", () => {
    const r14 = computeWristRingRadiusPx(200, 14, 1, 40, BOUNDS);
    const r19 = computeWristRingRadiusPx(200, 19, 1, 40, BOUNDS);
    expect(r19).toBeGreaterThan(r14);
  });
});

describe("mixed bead sizes on 16cm wrist", () => {
  it("lays out 0.5–10mm mix without overlap or extreme sizing", () => {
    const beads = [0.5, 2.5, 4, 6, 8, 10].map((mm) => mockPlaced(mm));
    assertCleanLayout(16, beads, 1);
    const dims = beads.map((b) => getBeadSlotDimensions(b, placedBeadSizeMm(b), 1));
    const widths = dims.map((d) => d.width);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
    expect(widths[0]).toBeGreaterThan(2);
    expect(widths[widths.length - 1]!).toBeLessThanOrEqual(36);
  });

  it("does not overlap 6/8/10/12mm crystals", () => {
    const beads = [6, 8, 10, 12, 8, 6].map((mm) => mockPlaced(mm));
    assertCleanLayout(16, beads);
  });
});

describe("adjacent mixed-size pairs", () => {
  const pairs: Array<{ label: string; beads: PlacedBead[] }> = [
    { label: "6mm + 10mm crystal", beads: [mockPlaced(6), mockPlaced(10)] },
    { label: "8mm + 12mm crystal", beads: [mockPlaced(8), mockPlaced(12)] },
    { label: "4mm spacer + 10mm crystal", beads: [mockPlaced(4, "spacer"), mockPlaced(10)] },
    { label: "10mm charm + 6mm crystal", beads: [mockPlaced(10, "charm"), mockPlaced(6)] },
    { label: "12mm + 4mm spacer + 10mm", beads: [mockPlaced(12), mockPlaced(4, "spacer"), mockPlaced(10)] },
  ];

  for (const { label, beads } of pairs) {
    it(`${label} on 16cm — clean clearance`, () => {
      assertCleanLayout(16, beads);
    });
  }
});

describe("wrist sizes 14–19 cm", () => {
  const wristSizes = [14, 15, 16, 17, 18, 19];

  it("preserves distinct wrist baselines when strand is empty", () => {
    const radii = wristSizes.map((cm) =>
      computeWristRingRadiusPx(200, cm, 1, 40, BOUNDS),
    );
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeGreaterThan(radii[i - 1]!);
    }
  });

  const crystalCombos: number[][] = [
    [8, 8, 8, 8, 8],
    [6, 8, 10, 12, 8, 6],
    [12, 12, 8, 8],
    [10, 10, 10, 10],
  ];

  for (const wristCm of wristSizes) {
    for (const combo of crystalCombos) {
      it(`crystals ${combo.join("/")}mm on ${wristCm}cm — no overlap`, () => {
        const beads = combo.map((mm) => mockPlaced(mm));
        assertCleanLayout(wristCm, beads);
      });
    }

    it(`charms + spacers on ${wristCm}cm — no overlap`, () => {
      const beads = [
        mockPlaced(10, "charm"),
        mockPlaced(4, "spacer"),
        mockPlaced(10, "charm"),
        mockPlaced(8),
        mockPlaced(4, "spacer"),
        mockPlaced(12),
      ];
      assertCleanLayout(wristCm, beads);
    });
  }

  it("meets or exceeds wrist baseline on small wrist with large beads", () => {
    const beads = [12, 12, 10, 10, 10, 10, 12, 12].map((mm) => mockPlaced(mm));
    const { resolved, layout } = layoutForWrist(14, beads);
    expect(resolved.radiusPx).toBeGreaterThanOrEqual(layout.wristRadiusPx - 0.5);
    assertCleanLayout(14, beads);
  });

  it("uses zero pair gap for continuous edge-to-edge layout", () => {
    const beads = [8, 10, 8].map((mm) => mockPlaced(mm));
    const base = layoutForWrist(16, beads, 1);
    const boosted = layoutForWrist(16, beads, 1.25);
    expect(base.pairGapPx).toBe(0);
    expect(boosted.pairGapPx).toBe(0);
    expect(scaledBeadSpacingPx(1.25).pairGapPx).toBe(0);
    assertCleanLayout(16, beads, 1.25);
  });
});

describe("resolveStrandRingLayout", () => {
  it("uses wrist size as baseline only — visual layout may expand", () => {
    const beads = [10, 10, 10, 10].map((mm) => mockPlaced(mm));
    const result = resolveStrandRingLayout({
      placed: beads,
      wristSizeCm: 14,
      wristSizeBounds: BOUNDS,
      canvasSize: 400,
      guideSizeMm: 8,
      renderCatalogue: TEST_STRAND_RENDER_CATALOGUE,
    });
    expect(result).not.toBeNull();
    expect(result!.resolved.radiusPx).toBeGreaterThanOrEqual(result!.wristRadiusPx);
  });
});
