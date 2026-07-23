/**
 * Circular path layout on the bracelet ring.
 * Stage 1: elastic arc-length distribution from strand occupancy.
 * Stage 2: anchor / offset / rotation applied in the renderer (see strand-render-profile).
 */
import type { StrandRenderProfile } from "@bino-foundry/shared/types";

import { resolveStrandRenderProfileBySlug } from "@/render/bead-crop/strand-render-profile";

import { balancedFractionsForSequence } from "./balanced-strand-layout";
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

/**
 * Balanced radial placement — recursive largest-gap bisection.
 *
 * Insertion order (unchanged):
 *   top → bottom → right → left → bisect largest remaining gaps …
 *
 * Each chronological bead is placed at its balanced angle fraction. Positions are NEVER
 * rebuilt by clockwise packing. Spacing tightens only because more beads share the ring
 * (smaller gaps between balanced targets) — no snap, no late redistribution.
 */
export function computeBalancedRadialStrandPathLayout(params: {
  beads: SequentialStrandBeadInput[];
  centerX: number;
  centerY: number;
  radius: number;
  startAngle?: number;
  /**
   * Reserved for API compatibility. Balanced fraction angles already densify with count;
   * this value must not reorder or repack beads.
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

  // Same balancing logic as before — map each sequence index to its fraction.
  const fractions = balancedFractionsForSequence(beads.length);

  const layouts = beads.map((bead, i) => {
    const angle = normalizePathAngle(startAngle + fractions[i]! * 2 * Math.PI);
    const arcSpan = ((footprintRadii[i]! * 2) / circumferencePx) * 2 * Math.PI;
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

  // Widest empty gap — where the next bead would land under the same algorithm.
  const sortedFractions = [...fractions].sort((a, b) => a - b);
  let widestGap = -Infinity;
  let widestGapMidFraction = (fractions[0] ?? 0) + 0.5;
  for (let i = 0; i < sortedFractions.length; i++) {
    const current = sortedFractions[i]!;
    const next =
      i + 1 < sortedFractions.length ? sortedFractions[i + 1]! : sortedFractions[0]! + 1;
    const gap = next - current;
    if (gap > widestGap) {
      widestGap = gap;
      widestGapMidFraction = current + gap / 2;
    }
  }
  const closureAngle = normalizePathAngle(
    startAngle + widestGapMidFraction * 2 * Math.PI,
  );

  const insertionAngles = [closureAngle];
  for (let i = 1; i < layouts.length; i++) {
    insertionAngles.push(
      midpointPathAngle(layouts[i - 1]!.angle, layouts[i]!.angle),
    );
  }
  insertionAngles.push(closureAngle);

  const totalFootprintPx = footprintRadii.reduce((sum, r) => sum + r * 2, 0);

  return {
    beads: layouts,
    insertionAngles,
    occupiedArcPx: totalFootprintPx,
    isOverCapacity: totalFootprintPx > circumferencePx + 1e-6,
  };
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
    profile.hangOffset !== 0 ? profile.hangOffset : profile.verticalOffset;
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

/** Visual shell size — mm-sized round beads ignore visualScale so ordering stays strict. */
export function strandLayoutShellDimensions(
  dim: BeadSlotDimensions,
  profile: Pick<StrandRenderProfile, "visualScale" | "forceRoundFootprint" | "attachmentStyle">,
): BeadSlotDimensions {
  if (profile.forceRoundFootprint && profile.attachmentStyle === "inline") {
    return dim;
  }
  return visualSlotDimensions(dim, profile);
}

/** Visual slot size after visualScale — does not affect strand occupancy. */
export function visualSlotDimensions(
  dim: BeadSlotDimensions,
  profile: Pick<StrandRenderProfile, "visualScale">,
): BeadSlotDimensions {
  const s = profile.visualScale;
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
  return profile.verticalOffset * dim.height;
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
