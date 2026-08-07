/**
 * Circular path layout on the bracelet ring.
 * Stage 1: elastic arc-length distribution from strand occupancy.
 * Stage 2: anchor / offset / rotation applied in the renderer (see strand-render-profile).
 */
import type { StrandRenderProfile } from "@bino-foundry/shared/types";
import { verticalOffsetHeightFraction } from "@bino-foundry/shared/types";

import { resolveStrandRenderProfileBySlug } from "@/render/bead-crop/strand-render-profile";

import { computeElasticBeadLayout } from "./strand-elastic-layout";

/** Default ring start — top of canvas (12 o'clock). */
export const STRAND_PATH_START_ANGLE = -Math.PI / 2;

/** Normalize any radian angle to (-π, π]. */
export function normalizePathAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Midpoint between two angles along their shortest arc. */
function midpointPathAngle(a: number, b: number): number {
  const delta = normalizePathAngle(b - a);
  return normalizePathAngle(a + delta / 2);
}

export interface StrandPathBeadInput {
  index: number;
  /** Physical bead diameter (mm) — retained for API compatibility; pricing uses composition layer. */
  beadMm?: number;
  /** Pixel extent — retained for radius fitting in the renderer; does not affect angular spacing. */
  extentPx?: number;
}

export interface StrandPathBeadLayout {
  index: number;
  /** Bead angle on the ring (radians). */
  angle: number;
  /** Equal arc segment per bead: 2π / n (radians). */
  arcSpan: number;
  x: number;
  y: number;
  /** Tangent-aligned CSS rotation in degrees at this position. */
  rotationDeg: number;
}

export interface SequentialStrandBeadInput {
  index: number;
  /** Capacity occupancy mapped onto the ring (px). */
  occupancyPx: number;
  /** Half of the actual rendered tangential silhouette (px). */
  visualRadiusPx: number;
  /** Optional per-bead contact adjustment (px); paired with the adjacent bead. */
  contactAdjustmentPx?: number;
}

export interface SequentialStrandPathLayout {
  beads: StrandPathBeadLayout[];
  insertionAngles: number[];
  /** Linear arc occupied from the first bead's leading edge to the last trailing edge. */
  occupiedArcPx: number;
  isOverCapacity: boolean;
  /** Contact path radius; differs only for calibrated closed-loop tangency. */
  resolvedRadiusPx?: number;
}

/** Cartesian position from polar coordinates (screen space, y-down). */
export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  theta: number,
): { x: number; y: number } {
  return {
    x: centerX + radius * Math.cos(theta),
    y: centerY + radius * Math.sin(theta),
  };
}

/**
 * Solve the common contact-path radius for a closed loop of tangent circular footprints.
 *
 * For adjacent footprint radii a,b on path radius R:
 *   Δθ = 2 asin((a + b) / (2R))
 *
 * A closed tangent loop requires ΣΔθ = 2π. This is the only positioning-only way to make
 * every neighbour (including the closing pair) tangent when measured rendered diameters do
 * not exactly match the nominal wrist circumference. It never changes rendered asset size.
 */
export function solveClosedTangentRingRadiusPx(
  radiiInAngularOrder: number[],
  fallbackRadiusPx: number,
): number {
  const radii = radiiInAngularOrder.map((r) => Math.max(0, r));
  if (radii.length < 3 || radii.every((r) => r <= 0)) return fallbackRadiusPx;

  const pairSums = radii.map((r, i) => r + radii[(i + 1) % radii.length]!);
  const minimum = Math.max(...pairSums) / 2 + 1e-7;
  const angleSum = (radius: number) =>
    pairSums.reduce(
      (sum, pair) => sum + 2 * Math.asin(Math.min(1, pair / (2 * radius))),
      0,
    );

  // Highly asymmetric footprints may not admit a common-radius tangent loop.
  if (angleSum(minimum) < 2 * Math.PI) return fallbackRadiusPx;

  let low = minimum;
  let high = Math.max(fallbackRadiusPx, minimum * 2);
  while (angleSum(high) > 2 * Math.PI && high < 1e7) high *= 2;

  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    if (angleSum(mid) > 2 * Math.PI) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * One ordered placement walk for every bead type.
 *
 * The first bead remains anchored at `startAngle`. Each following centre depends only on
 * the previous centre and the resolved footprints of that adjacent pair:
 *
 *   next = previous + previousRadius + currentRadius + pairContactAdjustment
 *
 * Occupancy remains a minimum half-footprint so capacity and rendering cannot diverge.
 * Visual radius may enlarge that footprint to prevent rendered silhouettes overlapping.
 * Inputs are consumed in array order; this function never sorts, groups, redistributes,
 * or branches on bead metadata.
 */
export function computeSequentialStrandPathLayout(params: {
  beads: SequentialStrandBeadInput[];
  centerX: number;
  centerY: number;
  radius: number;
  startAngle?: number;
}): SequentialStrandPathLayout {
  const {
    beads,
    centerX,
    centerY,
    radius,
    startAngle = STRAND_PATH_START_ANGLE,
  } = params;
  const circumferencePx = 2 * Math.PI * Math.max(radius, 1e-6);
  if (!beads.length || radius <= 0) {
    return {
      beads: [],
      insertionAngles: [startAngle],
      occupiedArcPx: 0,
      isOverCapacity: false,
    };
  }

  const footprintRadii = beads.map((bead) =>
    Math.max(
      Math.max(0, bead.occupancyPx) / 2,
      Math.max(0, bead.visualRadiusPx),
    ),
  );
  const centerOffsetsPx = new Array<number>(beads.length).fill(0);

  for (let i = 1; i < beads.length; i++) {
    const previous = beads[i - 1]!;
    const current = beads[i]!;
    const pairAdjustmentPx =
      ((previous.contactAdjustmentPx ?? 0) + (current.contactAdjustmentPx ?? 0)) / 2;
    const requiredDistancePx = Math.max(
      0,
      footprintRadii[i - 1]! + footprintRadii[i]! + pairAdjustmentPx,
    );
    centerOffsetsPx[i] = centerOffsetsPx[i - 1]! + requiredDistancePx;
  }

  const layouts = beads.map((bead, i) => {
    const angle = normalizePathAngle(
      startAngle + (centerOffsetsPx[i]! / circumferencePx) * 2 * Math.PI,
    );
    const arcSpan = (footprintRadii[i]! * 2 / circumferencePx) * 2 * Math.PI;
    const { x, y } = polarToCartesian(centerX, centerY, radius, angle);
    return {
      index: bead.index,
      angle,
      arcSpan,
      x,
      y,
      rotationDeg: tangentRotationDeg(angle),
    };
  });

  const firstLeadingEdgePx = -footprintRadii[0]!;
  const lastIndex = beads.length - 1;
  const lastTrailingEdgePx =
    centerOffsetsPx[lastIndex]! + footprintRadii[lastIndex]!;
  const occupiedArcPx = lastTrailingEdgePx - firstLeadingEdgePx;
  const closureMidpointPx =
    (lastTrailingEdgePx + circumferencePx + firstLeadingEdgePx) / 2;
  const closureAngle = normalizePathAngle(
    startAngle + (closureMidpointPx / circumferencePx) * 2 * Math.PI,
  );
  const insertionAngles = [closureAngle];

  for (let i = 1; i < beads.length; i++) {
    const previousTrailingEdge =
      centerOffsetsPx[i - 1]! + footprintRadii[i - 1]!;
    const currentLeadingEdge =
      centerOffsetsPx[i]! - footprintRadii[i]!;
    const midpointPx = (previousTrailingEdge + currentLeadingEdge) / 2;
    insertionAngles.push(
      normalizePathAngle(
        startAngle + (midpointPx / circumferencePx) * 2 * Math.PI,
      ),
    );
  }
  insertionAngles.push(closureAngle);

  return {
    beads: layouts,
    insertionAngles,
    occupiedArcPx,
    isOverCapacity: occupiedArcPx > circumferencePx + 1e-6,
  };
}

/**
 * Symmetric top-out placement using the same resolved footprint for every bead.
 *
 * Logical array order is preserved in the returned array, while visual positions alternate:
 * index 0 at the top, odd indices grow clockwise/right, even indices grow
 * counter-clockwise/left. Each side is an independent linked chain, so adding a bead only
 * advances the corresponding side and never redistributes existing positions.
 */
export function computeSymmetricStrandPathLayout(params: {
  beads: SequentialStrandBeadInput[];
  centerX: number;
  centerY: number;
  radius: number;
  startAngle?: number;
}): SequentialStrandPathLayout {
  const {
    beads,
    centerX,
    centerY,
    radius,
    startAngle = STRAND_PATH_START_ANGLE,
  } = params;
  const circumferencePx = 2 * Math.PI * Math.max(radius, 1e-6);
  if (!beads.length || radius <= 0) {
    return {
      beads: [],
      insertionAngles: [startAngle],
      occupiedArcPx: 0,
      isOverCapacity: false,
    };
  }

  const footprintRadii = beads.map((bead) =>
    Math.max(
      Math.max(0, bead.occupancyPx) / 2,
      Math.max(0, bead.visualRadiusPx),
    ),
  );
  const centerOffsetsPx = new Array<number>(beads.length).fill(0);

  for (let i = 1; i < beads.length; i++) {
    const previousOnSide = i <= 2 ? 0 : i - 2;
    const previous = beads[previousOnSide]!;
    const current = beads[i]!;
    const naturalContactPx =
      footprintRadii[previousOnSide]! + footprintRadii[i]!;
    const pairAdjustmentPx =
      ((previous.contactAdjustmentPx ?? 0) + (current.contactAdjustmentPx ?? 0)) / 2;
    // Contact adjustment may add intentional clearance, but must never pull actual
    // rendered silhouettes through one another.
    const requiredDistancePx = Math.max(
      naturalContactPx,
      naturalContactPx + pairAdjustmentPx,
    );
    const direction = i % 2 === 1 ? 1 : -1;
    centerOffsetsPx[i] =
      centerOffsetsPx[previousOnSide]! + direction * requiredDistancePx;
  }

  const layouts = beads.map((bead, i) => {
    const angle = normalizePathAngle(
      startAngle + (centerOffsetsPx[i]! / circumferencePx) * 2 * Math.PI,
    );
    const arcSpan = (footprintRadii[i]! * 2 / circumferencePx) * 2 * Math.PI;
    const { x, y } = polarToCartesian(centerX, centerY, radius, angle);
    return {
      index: bead.index,
      angle,
      arcSpan,
      x,
      y,
      rotationDeg: tangentRotationDeg(angle),
    };
  });

  const leadingEdges = centerOffsetsPx.map(
    (offset, i) => offset - footprintRadii[i]!,
  );
  const trailingEdges = centerOffsetsPx.map(
    (offset, i) => offset + footprintRadii[i]!,
  );
  const minLeadingEdgePx = Math.min(...leadingEdges);
  const maxTrailingEdgePx = Math.max(...trailingEdges);
  const occupiedArcPx = maxTrailingEdgePx - minLeadingEdgePx;
  const closureMidpointPx =
    (maxTrailingEdgePx + circumferencePx + minLeadingEdgePx) / 2;
  const closureAngle = normalizePathAngle(
    startAngle + (closureMidpointPx / circumferencePx) * 2 * Math.PI,
  );
  const insertionAngles = [closureAngle];

  for (let i = 1; i < layouts.length; i++) {
    insertionAngles.push(
      midpointPathAngle(layouts[i - 1]!.angle, layouts[i]!.angle),
    );
  }
  insertionAngles.push(closureAngle);

  return {
    beads: layouts,
    insertionAngles,
    occupiedArcPx,
    isOverCapacity: occupiedArcPx > circumferencePx + 1e-6,
  };
}

/** easeOutCubic — retained for callers/tests; balanced placement no longer packs with it. */
export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

/** Chord angle for two circular footprints whose centres are exactly `pairRadius` apart. */
export function contactChordAngleRad(pairRadius: number, pathRadius: number): number {
  const R = Math.max(pathRadius, 1e-6);
  return 2 * Math.asin(Math.min(1, Math.max(0, pairRadius) / (2 * R)));
}

function clockwiseArcDistancePx(from: number, to: number, circumferencePx: number): number {
  const delta = (to - from) % circumferencePx;
  return delta < 0 ? delta + circumferencePx : delta;
}

function normalizeArcDistancePx(distance: number, circumferencePx: number): number {
  const normalized = distance % circumferencePx;
  return normalized < 0 ? normalized + circumferencePx : normalized;
}

/**
 * Project values onto a bounded non-decreasing sequence. This is isotonic regression
 * (pool-adjacent-violators), used so only beads around an insertion move when its
 * footprint does not fit the selected gap.
 */
function boundedIsotonicProjection(values: number[], upperBound: number): number[] {
  const upper = Math.max(0, upperBound);
  const blocks: Array<{ start: number; end: number; sum: number; count: number }> = [];

  values.forEach((rawValue, index) => {
    const value = Math.max(0, Math.min(upper, rawValue));
    blocks.push({ start: index, end: index, sum: value, count: 1 });
    while (blocks.length >= 2) {
      const right = blocks[blocks.length - 1]!;
      const left = blocks[blocks.length - 2]!;
      if (left.sum / left.count <= right.sum / right.count + 1e-9) break;
      blocks.splice(blocks.length - 2, 2, {
        start: left.start,
        end: right.end,
        sum: left.sum + right.sum,
        count: left.count + right.count,
      });
    }
  });

  const projected = new Array<number>(values.length);
  blocks.forEach((block) => {
    const value = block.sum / block.count;
    for (let index = block.start; index <= block.end; index++) projected[index] = value;
  });
  return projected;
}

/**
 * Final optical pass: equalise empty neighbour gaps while keeping occupancy widths.
 * Pins bead 0 so the bracelet does not rotate. Not equal-angle — centre arcs still
 * vary with bead size; only free space between footprints is shared evenly.
 *
 * Restored from the Top → Bottom → Right → Left largest-gap ordering path: this pass
 * must not reassign beads across quadrants or force cardinals after insertion.
 */
function balanceEmptyNeighbourGapsPx(params: {
  positionsPx: number[];
  widthsPx: number[];
  circumferencePx: number;
  gapPx: number;
}): number[] {
  const { positionsPx, widthsPx, circumferencePx, gapPx } = params;
  const count = positionsPx.length;
  if (count < 2) return [...positionsPx];

  const order = Array.from({ length: count }, (_, index) => index).sort(
    (a, b) => positionsPx[a]! - positionsPx[b]!,
  );
  const occupiedPx = widthsPx.reduce((sum, width) => sum + width, 0);
  const freePx = Math.max(0, circumferencePx - occupiedPx - count * gapPx);
  const targetEmptyPx = freePx / count;

  const balanced = new Array<number>(count);
  const anchorIndex = 0;
  const startSlot = order.indexOf(anchorIndex);
  const rotatedOrder = [
    ...order.slice(startSlot),
    ...order.slice(0, startSlot),
  ];

  let cursorPx = positionsPx[anchorIndex]!;
  balanced[anchorIndex] = cursorPx;
  for (let slot = 0; slot < rotatedOrder.length - 1; slot++) {
    const leftIndex = rotatedOrder[slot]!;
    const rightIndex = rotatedOrder[slot + 1]!;
    cursorPx = normalizeArcDistancePx(
      cursorPx +
        widthsPx[leftIndex]! / 2 +
        gapPx +
        targetEmptyPx +
        widthsPx[rightIndex]! / 2,
      circumferencePx,
    );
    balanced[rightIndex] = cursorPx;
  }

  return balanced;
}

/**
 * Occupancy-aware strand placement with fixed orientation.
 *
 * Default `placement: "physical-contact"`:
 *   Walk the bead array in order along the ring (bead 0 anchored at startAngle).
 *   Optional Balance Spacing equalises leftover empty gaps without changing occupancy
 *   or neighbour order (bead 0 stays put).
 *
 * Opt-in `placement: "largest-gap"` (legacy): Top → Bottom → Right → Left anchors.
 * Prefer physical-contact for the live Builder — largest-gap breaks sequence stability.
 */
export function computeBalancedRadialStrandPathLayout(params: {
  beads: SequentialStrandBeadInput[];
  centerX: number;
  centerY: number;
  radius: number;
  startAngle?: number;
  /** Minimum clearance between neighbouring beads along the strand (px). Default 0. */
  minGapPx?: number;
  /**
   * When true (default), equalise empty neighbour gaps after placement.
   * Pins bead 0; does not reshuffle insertion / neighbour order.
   */
  balanceSpacing?: boolean;
  /**
   * `"physical-contact"` (default): pack in array order along the ring.
   * `"largest-gap"`: legacy Top → Bottom → Right → Left anchors (unstable on insert).
   */
  placement?: "physical-contact" | "largest-gap";
  /**
   * @deprecated Informational only — positions come from occupancy along the strand.
   */
  compressionRatio?: number;
  /**
   * @deprecated No longer switches algorithm. Kept so existing callers compile.
   */
  closeLoop?: boolean;
}): SequentialStrandPathLayout {
  const {
    beads,
    centerX,
    centerY,
    radius,
    startAngle = STRAND_PATH_START_ANGLE,
    minGapPx = 0,
    balanceSpacing = true,
    placement = "physical-contact",
  } = params;
  const circumferencePx = 2 * Math.PI * Math.max(radius, 1e-6);
  const gapPx = Math.max(0, minGapPx);
  if (!beads.length || radius <= 0) {
    return {
      beads: [],
      insertionAngles: [startAngle],
      occupiedArcPx: 0,
      isOverCapacity: false,
    };
  }

  const rawWidthsPx = beads.map((bead) => Math.max(0, bead.occupancyPx));
  const rawOccupiedPx = rawWidthsPx.reduce((sum, width) => sum + width, 0);
  const circularGapsPx = beads.length > 1 ? beads.length * gapPx : 0;
  const isOverCapacity = rawOccupiedPx + circularGapsPx > circumferencePx + 1e-6;
  const availableForOccupancyPx = Math.max(0, circumferencePx - circularGapsPx);
  const scale = isOverCapacity
    ? availableForOccupancyPx / Math.max(rawOccupiedPx, 1e-6)
    : 1;
  const widthsPx = rawWidthsPx.map((width) => width * scale);
  let positionsPx = new Array<number>(beads.length).fill(0);

  if (placement === "physical-contact") {
    positionsPx = packPhysicalContactPositionsPx({
      widthsPx,
      circumferencePx,
      gapPx,
    });
  } else {
    // Legacy largest-gap anchors (kept for tests / opt-in callers only).
    const anchorFractions = [0, 0.5, 0.25, 0.75] as const;
    for (let index = 0; index < Math.min(beads.length, anchorFractions.length); index++) {
      positionsPx[index] = anchorFractions[index]! * circumferencePx;
    }

    // Tie preference reproduces the requested first split sequence. Later equal gaps
    // prefer the point furthest from the most recently inserted bead.
    const preferredFractions = [0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.875, 0.375] as const;

    for (let newIndex = 4; newIndex < beads.length; newIndex++) {
      const existing = Array.from({ length: newIndex }, (_, index) => index).sort(
        (a, b) => positionsPx[a]! - positionsPx[b]!,
      );
      const gaps = existing.map((leftIndex, slot) => {
        const rightIndex = existing[(slot + 1) % existing.length]!;
        const centerArcPx = clockwiseArcDistancePx(
          positionsPx[leftIndex]!,
          positionsPx[rightIndex]!,
          circumferencePx,
        );
        const emptyArcPx =
          centerArcPx - widthsPx[leftIndex]! / 2 - widthsPx[rightIndex]! / 2 - gapPx;
        const midpointPx = normalizeArcDistancePx(
          positionsPx[leftIndex]! +
            widthsPx[leftIndex]! / 2 +
            gapPx / 2 +
            Math.max(0, emptyArcPx) / 2,
          circumferencePx,
        );
        return { leftIndex, rightIndex, emptyArcPx, midpointPx };
      });

      const largestEmptyArcPx = Math.max(...gaps.map((gap) => gap.emptyArcPx));
      const tiedLargest = gaps.filter(
        (gap) => largestEmptyArcPx - gap.emptyArcPx <= 1e-6,
      );
      const preferredPx =
        newIndex < preferredFractions.length
          ? preferredFractions[newIndex]! * circumferencePx
          : positionsPx[newIndex - 1]! + circumferencePx / 2;
      const selectedGap = tiedLargest.reduce((best, candidate) => {
        const bestDistance = Math.min(
          clockwiseArcDistancePx(best.midpointPx, preferredPx, circumferencePx),
          clockwiseArcDistancePx(preferredPx, best.midpointPx, circumferencePx),
        );
        const candidateDistance = Math.min(
          clockwiseArcDistancePx(candidate.midpointPx, preferredPx, circumferencePx),
          clockwiseArcDistancePx(preferredPx, candidate.midpointPx, circumferencePx),
        );
        return candidateDistance < bestDistance - 1e-6 ? candidate : best;
      });

      const targetPx = selectedGap.midpointPx;
      positionsPx[newIndex] = targetPx;

      // Cut the circle at the inserted bead and find the least-movement valid placement
      // for all existing beads under occupancy + minimum-spacing constraints.
      const clockwiseExisting = existing
        .map((index) => ({
          index,
          distancePx: clockwiseArcDistancePx(targetPx, positionsPx[index]!, circumferencePx),
        }))
        .sort((a, b) => a.distancePx - b.distancePx);
      const requiredPositionsPx: number[] = [];
      let requiredPx = 0;
      let previousIndex = newIndex;
      clockwiseExisting.forEach(({ index }) => {
        requiredPx += widthsPx[previousIndex]! / 2 + widthsPx[index]! / 2 + gapPx;
        requiredPositionsPx.push(requiredPx);
        previousIndex = index;
      });
      const slackPx = Math.max(
        0,
        circumferencePx -
          requiredPx -
          widthsPx[previousIndex]! / 2 -
          widthsPx[newIndex]! / 2 -
          gapPx,
      );
      const freeOffsetsPx = clockwiseExisting.map(
        ({ distancePx }, index) => distancePx - requiredPositionsPx[index]!,
      );
      const projectedOffsetsPx = boundedIsotonicProjection(freeOffsetsPx, slackPx);
      clockwiseExisting.forEach(({ index }, orderIndex) => {
        positionsPx[index] = normalizeArcDistancePx(
          targetPx + requiredPositionsPx[orderIndex]! + projectedOffsetsPx[orderIndex]!,
          circumferencePx,
        );
      });
    }
  }

  if (balanceSpacing) {
    positionsPx = balanceEmptyNeighbourGapsPx({
      positionsPx,
      widthsPx,
      circumferencePx,
      gapPx,
    });
  }

  const layouts = beads.map((bead, i) => {
    const width = widthsPx[i]!;
    const angle = normalizePathAngle(
      startAngle + (positionsPx[i]! / circumferencePx) * 2 * Math.PI,
    );
    const arcSpan = (width / circumferencePx) * 2 * Math.PI;
    const { x, y } = polarToCartesian(centerX, centerY, radius, angle);
    return {
      index: bead.index,
      angle,
      arcSpan,
      x,
      y,
      rotationDeg: tangentRotationDeg(angle),
    };
  });

  /**
   * Gap angles indexed for {@link insertBeadAt}:
   * `insertionAngles[i]` is the gap where a new bead becomes index `i`.
   * For n beads that is: closure, then gaps before beads 1…n-1, then closure again.
   * Do not key gaps off angular-order slot alone — that is off-by-one vs array insert.
   */
  const gapAngleBetween = (leftIndex: number, rightIndex: number): number => {
    const leftTrailingPx = positionsPx[leftIndex]! + widthsPx[leftIndex]! / 2;
    const travelPx = clockwiseArcDistancePx(
      leftTrailingPx,
      positionsPx[rightIndex]! - widthsPx[rightIndex]! / 2,
      circumferencePx,
    );
    const midpointPx = normalizeArcDistancePx(leftTrailingPx + travelPx / 2, circumferencePx);
    return normalizePathAngle(startAngle + (midpointPx / circumferencePx) * 2 * Math.PI);
  };

  const insertionAngles: number[] = [];
  if (beads.length === 1) {
    const beadAngle = layouts[0]!.angle;
    const span = layouts[0]!.arcSpan;
    const halfEmpty = (2 * Math.PI - span) / 2;
    insertionAngles.push(normalizePathAngle(beadAngle - span / 2 - halfEmpty / 2));
    insertionAngles.push(normalizePathAngle(beadAngle + span / 2 + halfEmpty / 2));
  } else {
    const closureAngle = gapAngleBetween(beads.length - 1, 0);
    insertionAngles.push(closureAngle);
    for (let i = 1; i < beads.length; i++) {
      insertionAngles.push(gapAngleBetween(i - 1, i));
    }
    insertionAngles.push(closureAngle);
  }

  const occupiedArcPx = widthsPx.reduce((sum, width) => sum + width, 0);

  // Return beads in chronological array order (renderer index mapping).
  return {
    beads: layouts,
    insertionAngles,
    occupiedArcPx,
    isOverCapacity,
  };
}

/** Edge-to-edge packing along the ring in array order (bead 0 centered at arc origin). */
function packPhysicalContactPositionsPx(params: {
  widthsPx: number[];
  circumferencePx: number;
  gapPx: number;
}): number[] {
  const { widthsPx, gapPx } = params;
  const positionsPx = new Array<number>(widthsPx.length).fill(0);
  if (widthsPx.length === 0) return positionsPx;
  // Center of bead 0 stays at 0 so angle === startAngle (top anchor).
  positionsPx[0] = 0;
  for (let i = 1; i < widthsPx.length; i++) {
    positionsPx[i] =
      positionsPx[i - 1]! + widthsPx[i - 1]! / 2 + gapPx + widthsPx[i]! / 2;
  }
  return positionsPx;
}

/** Even angular step for n beads around a full circle. */
export function evenBeadAngleStepRad(count: number): number {
  if (count <= 0) return 0;
  return (2 * Math.PI) / count;
}

/**
 * θᵢ = (360° / n) × i with optional start offset (default 12 o'clock).
 * Returns angle in radians.
 */
export function evenBeadAngleRad(
  index: number,
  count: number,
  startAngle = STRAND_PATH_START_ANGLE,
): number {
  if (count <= 0) return startAngle;
  return startAngle + evenBeadAngleStepRad(count) * index;
}

/**
 * Tangent direction when traveling clockwise along the ring (increasing θ).
 * Equivalent to offset-path auto rotation on a circular path.
 */
export function tangentRotationRad(angle: number): number {
  return Math.atan2(Math.cos(angle), -Math.sin(angle));
}

export function tangentRotationDeg(angle: number): number {
  return (tangentRotationRad(angle) * 180) / Math.PI;
}

/** @deprecated Even distribution no longer uses arc-length weighting. */
export function visualMmFromArcExtent(
  extentPx: number,
  radius: number,
  layoutCircumferenceMm: number,
): number {
  if (radius <= 0 || extentPx <= 0) return 0;
  const circumferencePx = 2 * Math.PI * radius;
  return (extentPx / circumferencePx) * layoutCircumferenceMm;
}

/** Radial outward rotation so hanging assets face away from the bracelet centre. */
export function radialOutwardRotationDeg(angle: number): number {
  return (angle * 180) / Math.PI + 90;
}

/** Radial inward rotation — front faces toward the bracelet centre. */
export function radialInwardRotationDeg(angle: number): number {
  return radialOutwardRotationDeg(angle) + 180;
}

/** Strand rotation from data-driven render profile (never from category slug). */
export function strandRotationDeg(angle: number, profile: StrandRenderProfile): number {
  if (profile.rotationMode === "fixed-upright" || profile.rotationMode === "none") {
    return profile.rotationOffsetDeg;
  }

  // Processed bead art faces the raster bottom; radialOutward aligns image top with the
  // outward normal (legacy tangent / rotationMode). Visual front-outward needs +180°.
  const base =
    profile.orientationMode === "inward"
      ? radialOutwardRotationDeg(angle)
      : radialInwardRotationDeg(angle);
  return base + profile.rotationOffsetDeg;
}

/**
 * @deprecated Use strandRotationDeg(angle, profile). Slug lookup is fallback only.
 */
export function beadStrandRotationDeg(angle: number, beadTypeSlug?: string): number {
  return strandRotationDeg(angle, resolveStrandRenderProfileBySlug(beadTypeSlug));
}

export interface BeadSlotDimensions {
  width: number;
  height: number;
}

export interface BeadShellPlacement {
  left: number;
  top: number;
  /** Anchor pivot in shell-local pixels (for CSS transform-origin). */
  transformOriginX: number;
  transformOriginY: number;
}

/**
 * Position shell so the profile anchor sits on the ring point.
 * Stage 2 render positioning — separate from strand occupancy layout.
 * Bitmap size affects rendering only; attachment uses anchor + vertical offset.
 */
export function computeBeadShellPosition(
  ringX: number,
  ringY: number,
  angle: number,
  dim: BeadSlotDimensions,
  profile: StrandRenderProfile,
): BeadShellPlacement {
  const renderDim = strandLayoutShellDimensions(dim, profile);
  const hang =
    profile.hangOffset !== 0
      ? profile.hangOffset
      : verticalOffsetHeightFraction(profile.verticalOffset);
  const radial = hang * renderDim.height;
  const anchorX = ringX + radial * Math.cos(angle);
  const anchorY = ringY + radial * Math.sin(angle);
  const originX = profile.anchorX * renderDim.width;
  const originY = profile.anchorY * renderDim.height;
  return {
    left: anchorX - originX,
    top: anchorY - originY,
    transformOriginX: originX,
    transformOriginY: originY,
  };
}

/** Visual shell size after hierarchical render calibration — does not affect occupancy. */
export function strandLayoutShellDimensions(
  dim: BeadSlotDimensions,
  profile: Pick<
    StrandRenderProfile,
    "visualScale" | "layoutScale" | "forceRoundFootprint" | "attachmentStyle"
  >,
): BeadSlotDimensions {
  return visualSlotDimensions(dim, profile);
}

/**
 * Visual slot size after layoutScale × visualScale — does not affect capacity mm.
 * layoutScale here matches contact-arc calibration so shells stay aligned with packing.
 */
export function visualSlotDimensions(
  dim: BeadSlotDimensions,
  profile: Pick<StrandRenderProfile, "visualScale" | "layoutScale">,
): BeadSlotDimensions {
  const layout = Number.isFinite(profile.layoutScale) ? profile.layoutScale : 1;
  const visual = Number.isFinite(profile.visualScale) ? profile.visualScale : 1;
  const s = layout * visual;
  if (!Number.isFinite(s) || s <= 0 || s === 1) return dim;
  return { width: dim.width * s, height: dim.height * s };
}

/**
 * @deprecated Use computeBeadShellPosition with StrandRenderProfile.
 */
export function beadRingAlignOffsetPx(
  beadTypeSlug: string | undefined,
  dim: { width: number; height: number },
): number {
  const profile = resolveStrandRenderProfileBySlug(beadTypeSlug);
  if (profile.verticalOffset === 0 && profile.anchorPreset === "center") return 0;
  return verticalOffsetHeightFraction(profile.verticalOffset) * dim.height;
}

export function applyRingAlignOffset(
  x: number,
  y: number,
  angle: number,
  offsetPx: number,
): { x: number; y: number } {
  if (offsetPx === 0) return { x, y };
  return {
    x: x + offsetPx * Math.cos(angle),
    y: y + offsetPx * Math.sin(angle),
  };
}

/**
 * @deprecated Use profile.rotationOffsetDeg via resolveStrandRenderProfile.
 */
export function beadTypeRotationOffsetDeg(beadTypeSlug?: string): number {
  return resolveStrandRenderProfileBySlug(beadTypeSlug).rotationOffsetDeg;
}

function useElasticWeights(beads: StrandPathBeadInput[], layoutCircumferenceMm?: number): boolean {
  if (!layoutCircumferenceMm || layoutCircumferenceMm <= 0) return false;
  return beads.some((b) => (b.beadMm ?? 0) > 0);
}

/**
 * Place beads on a circular path with contiguous arc-length packing when
 * `layoutCircumferenceMm` + per-bead weights are supplied.
 */
export function computeStrandPathLayout(params: {
  beads: StrandPathBeadInput[];
  layoutCircumferenceMm?: number;
  centerX: number;
  centerY: number;
  radius: number;
  startAngle?: number;
  rotationOffsetByIndex?: (index: number) => number;
  /** Minimum arc gap between adjacent beads (same units as layoutCircumferenceMm). */
  minGapPx?: number;
  /** Contact junction overlaps (px) — enables contact-geometry packing. */
  contactOverlaps?: { leadingPx: number[]; trailingPx: number[] };
}): StrandPathBeadLayout[] {
  const {
    beads,
    layoutCircumferenceMm,
    centerX,
    centerY,
    radius,
    startAngle = STRAND_PATH_START_ANGLE,
    rotationOffsetByIndex,
    minGapPx = 0,
    contactOverlaps,
  } = params;

  const n = beads.length;
  if (!n || radius <= 0) return [];

  if (useElasticWeights(beads, layoutCircumferenceMm)) {
    const beadArcMm = beads.map((b) => Math.max(0, b.beadMm ?? 0));
    const elastic = computeElasticBeadLayout(
      beadArcMm,
      layoutCircumferenceMm!,
      startAngle,
      minGapPx,
      contactOverlaps,
    );
    return beads.map((bead, i) => {
      const angle = elastic.angles[i]!;
      const arcSpan = elastic.arcSpans[i]!;
      const { x, y } = polarToCartesian(centerX, centerY, radius, angle);
      const offset = rotationOffsetByIndex?.(bead.index) ?? 0;
      return {
        index: bead.index,
        angle,
        arcSpan,
        x,
        y,
        rotationDeg: tangentRotationDeg(angle) + offset,
      };
    });
  }

  const arcSpan = evenBeadAngleStepRad(n);

  return beads.map((bead, i) => {
    const angle = evenBeadAngleRad(i, n, startAngle);
    const { x, y } = polarToCartesian(centerX, centerY, radius, angle);
    const offset = rotationOffsetByIndex?.(bead.index) ?? 0;
    return {
      index: bead.index,
      angle,
      arcSpan,
      x,
      y,
      rotationDeg: tangentRotationDeg(angle) + offset,
    };
  });
}

/**
 * Map pointer angle to bead index using equal angular sectors (best for reorder/drop).
 * Each sector is centered on its bead — pointer in sector i targets index i.
 */
export function beadIndexFromPointerAngle(
  pointerAngle: number,
  count: number,
  startAngle = STRAND_PATH_START_ANGLE,
): number {
  if (count <= 0) return 0;
  const step = evenBeadAngleStepRad(count);
  let rel = pointerAngle - startAngle;
  while (rel < 0) rel += 2 * Math.PI;
  while (rel >= 2 * Math.PI) rel -= 2 * Math.PI;
  return Math.floor((rel + step / 2) / step) % count;
}

/** Angle at insertion gap `insertIndex` (0 = before first bead; n = after last). */
export function insertionAngleRad(
  insertIndex: number,
  beadCount: number,
  startAngle = STRAND_PATH_START_ANGLE,
): number {
  if (beadCount <= 0) return startAngle;
  const step = evenBeadAngleStepRad(beadCount);
  return startAngle + step * (insertIndex - 0.5);
}

export function insertionSlotCount(beadCount: number): number {
  return beadCount === 0 ? 1 : beadCount + 1;
}

/** Map pointer angle to insertion index (0..n) for gap-centered drop zones. */
export function insertionIndexFromPointerAngle(
  pointerAngle: number,
  beadCount: number,
  startAngle = STRAND_PATH_START_ANGLE,
): number {
  if (beadCount === 0) return 0;
  const step = evenBeadAngleStepRad(beadCount);
  let rel = pointerAngle - startAngle + step / 2;
  while (rel < 0) rel += 2 * Math.PI;
  while (rel >= 2 * Math.PI) rel -= 2 * Math.PI;
  const gap = Math.floor(rel / step);
  return Math.min(gap, beadCount);
}

function normalizeAngle(a: number): number {
  let x = a % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x;
}

function angularDistance(a: number, b: number): number {
  const delta = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(delta, 2 * Math.PI - delta);
}

export type StrandDropTarget =
  | { mode: "insert"; index: number; /** First-bead anchor on empty strand (radians). */ anchorAngleRad?: number }
  | { mode: "replace"; index: number };

/** Distinguish gap insertion vs bead replacement from pointer angle. */
export function resolveStrandDropTarget(
  pointerAngle: number,
  beadCount: number,
  startAngle = STRAND_PATH_START_ANGLE,
): StrandDropTarget {
  if (beadCount === 0) return { mode: "insert", index: 0 };

  const beadIdx = beadIndexFromPointerAngle(pointerAngle, beadCount, startAngle);
  const insertIdx = insertionIndexFromPointerAngle(pointerAngle, beadCount, startAngle);
  const beadAngle = evenBeadAngleRad(beadIdx, beadCount, startAngle);
  const gapAngle = insertionAngleRad(insertIdx, beadCount, startAngle);
  const toBead = angularDistance(pointerAngle, beadAngle);
  const toGap = angularDistance(pointerAngle, gapAngle);

  if (toBead <= toGap * 0.92) {
    return { mode: "replace", index: beadIdx };
  }
  return { mode: "insert", index: insertIdx };
}

/** Nearest bead index by polar angle (legacy nearest-center). */
export function findNearestBeadIndexByAngle(
  beads: Pick<StrandPathBeadLayout, "index" | "angle">[],
  pointerAngle: number,
): number {
  if (!beads.length) return 0;
  const norm = (a: number) => {
    let x = a % (2 * Math.PI);
    if (x < 0) x += 2 * Math.PI;
    return x;
  };
  const target = norm(pointerAngle);
  let best = beads[0]!.index;
  let bestDelta = Infinity;
  for (const b of beads) {
    const delta = Math.abs(norm(b.angle) - target);
    const wrap = Math.min(delta, 2 * Math.PI - delta);
    if (wrap < bestDelta) {
      bestDelta = wrap;
      best = b.index;
    }
  }
  return best;
}

export function pointerAngleOnCanvas(
  centerX: number,
  centerY: number,
  localX: number,
  localY: number,
): number {
  return Math.atan2(localY - centerY, localX - centerX);
}
