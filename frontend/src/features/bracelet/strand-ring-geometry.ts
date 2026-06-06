import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import {
  getBeadSlotDimensions,
  getMaxSlotExtent,
  getBeadTangentArcPx,
  type BeadSlotDimensions,
} from "@/render/bead-crop";

import { normalizeFromSlots } from "./composition";

import { computeMaxRingRadiusPx, computeWristRingRadiusPx, type WristSizeBounds } from "./strand-ring";
import { STRAND_LAYOUT_BASELINE_PX } from "./strand-viewport";

/** Tight gap between adjacent bead edges at layout scale factor 1. */
export const BEAD_PAIR_GAP_BASE_PX = 0.75;

/** Minimal arc per side for anti-alias bleed at layout scale factor 1. */
export const BEAD_VISUAL_BLEED_BASE_PX = 0.4;

/** Small epsilon so floating-point layout does not under-allocate arc. */
const SPACING_EPSILON_PX = 0.25;

export interface BeadSpacingPx {
  pairGapPx: number;
  bleedPx: number;
}

/** Scaled spacing buffers — subtle at all canvas sizes, never shrinks beads. */
export function scaledBeadSpacingPx(scaleFactor: number): BeadSpacingPx {
  const sf = Math.max(0.5, scaleFactor);
  return {
    pairGapPx: Math.max(0.5, BEAD_PAIR_GAP_BASE_PX * sf),
    bleedPx: Math.max(0.35, BEAD_VISUAL_BLEED_BASE_PX * sf),
  };
}

/**
 * Rendered arc occupancy for layout: tangent width + bleed on both sides.
 * Does not include inter-bead pair gap (added separately between neighbors).
 */
export function beadLayoutArcPx(dim: BeadSlotDimensions, scaleFactor: number): number {
  const { bleedPx } = scaledBeadSpacingPx(scaleFactor);
  return getBeadTangentArcPx(dim) + bleedPx * 2;
}

/**
 * Visual arc slot for a bead on the ring.
 * Wrist mm capacity is tracked separately — layout is not forced to wrist circumference.
 */
export function beadArcPxOnRing(layoutArcPx: number): number {
  return layoutArcPx;
}

export interface ResolvedRingRadiusResult {
  radiusPx: number;
  /** True when radius was increased beyond the wrist-sized baseline to prevent overlap. */
  expanded: boolean;
  /** True when the resolved ring exceeds available canvas radius (zoom/pan may help). */
  isVisualOverCanvas: boolean;
  beadArcPx: number[];
  pairGapPx: number;
}

/**
 * Resolve ring radius from wrist baseline + rendered bead extents so adjacent beads do not overlap.
 * Expands the ring when needed; never clamps below the overlap-free radius.
 */
export function computeResolvedRingRadiusPx(params: {
  beadLayoutArcPx: number[];
  wristRadiusPx: number;
  maxRadiusPx: number;
  scaleFactor?: number;
  pairGapPx?: number;
}): ResolvedRingRadiusResult {
  const {
    beadLayoutArcPx: layoutArcs,
    wristRadiusPx,
    maxRadiusPx,
    scaleFactor = 1,
    pairGapPx = scaledBeadSpacingPx(scaleFactor).pairGapPx,
  } = params;

  const n = layoutArcs.length;
  if (!n) {
    return {
      radiusPx: Math.max(1, wristRadiusPx),
      expanded: false,
      isVisualOverCanvas: false,
      beadArcPx: [],
      pairGapPx,
    };
  }

  let radiusPx = Math.max(1, wristRadiusPx);
  let beadArcPx: number[] = layoutArcs.map(beadArcPxOnRing);

  for (let iter = 0; iter < 16; iter++) {
    beadArcPx = layoutArcs.map(beadArcPxOnRing);
    const totalArcPx =
      beadArcPx.reduce((sum, arc) => sum + arc, 0) + n * pairGapPx + SPACING_EPSILON_PX;
    const neededRadius = totalArcPx / (2 * Math.PI);
    const nextRadius = Math.max(wristRadiusPx, neededRadius);
    if (Math.abs(nextRadius - radiusPx) < 0.25) {
      radiusPx = nextRadius;
      break;
    }
    radiusPx = nextRadius;
  }

  const expanded = radiusPx > wristRadiusPx + 0.5;
  const isVisualOverCanvas = radiusPx > maxRadiusPx + 0.5;

  return {
    radiusPx,
    expanded,
    isVisualOverCanvas,
    beadArcPx,
    pairGapPx,
  };
}

export interface ResolveStrandRingLayoutResult {
  center: number;
  scaleFactor: number;
  wristRadiusPx: number;
  maxRadiusPx: number;
  resolved: ResolvedRingRadiusResult;
  prelimDims: BeadSlotDimensions[];
}

/**
 * Shared wrist-baseline + elastic-expansion resolution for renderer and UI hints.
 * Wrist size sets the minimum ring radius; visual layout may expand beyond it.
 */
export function resolveStrandRingLayout(params: {
  placed: PlacedBead[];
  wristSizeCm: number;
  wristSizeBounds: WristSizeBounds;
  canvasSize: number;
  guideSizeMm: number;
  beadScaleBoost?: number;
}): ResolveStrandRingLayoutResult | null {
  const {
    placed,
    wristSizeCm,
    wristSizeBounds,
    canvasSize,
    guideSizeMm,
    beadScaleBoost = 1,
  } = params;

  const normalized = normalizeFromSlots(placed);
  if (!normalized.length) return null;

  const center = canvasSize / 2;
  const scaleFactor = (canvasSize / STRAND_LAYOUT_BASELINE_PX) * beadScaleBoost;
  const prelimDims = normalized.map((p) =>
    getBeadSlotDimensions(p, placedBeadSizeMm(p), scaleFactor),
  );
  const maxExtent = getMaxSlotExtent(prelimDims);
  const bounds =
    wristSizeBounds.minCm > 0 && wristSizeBounds.maxCm > 0
      ? wristSizeBounds
      : { minCm: wristSizeCm, maxCm: wristSizeCm };

  const wristRadiusPx = computeWristRingRadiusPx(
    center,
    wristSizeCm,
    scaleFactor,
    maxExtent,
    bounds,
  );
  const maxRadiusPx = computeMaxRingRadiusPx(center, scaleFactor, maxExtent);
  const beadLayoutArcsPx = prelimDims.map((dim) => beadLayoutArcPx(dim, scaleFactor));
  const resolved = computeResolvedRingRadiusPx({
    beadLayoutArcPx: beadLayoutArcsPx,
    wristRadiusPx,
    maxRadiusPx,
    scaleFactor,
  });

  return {
    center,
    scaleFactor,
    wristRadiusPx,
    maxRadiusPx,
    resolved,
    prelimDims,
  };
}

/** Arc-length clearance between two adjacent bead centers on the ring (px). */
export function adjacentArcClearancePx(
  angleA: number,
  arcPxA: number,
  angleB: number,
  arcPxB: number,
  radiusPx: number,
): number {
  let delta = Math.abs(angleB - angleA);
  if (delta > Math.PI) delta = 2 * Math.PI - delta;
  const centerDistPx = delta * radiusPx;
  return centerDistPx - arcPxA / 2 - arcPxB / 2;
}

/** Verify adjacent bead sectors do not overlap on the ring (for tests). */
export function beadSectorsOverlap(
  angles: number[],
  arcSpans: number[],
  tolerance = 1,
): boolean {
  if (angles.length < 2) return false;
  for (let i = 0; i < angles.length; i++) {
    const j = (i + 1) % angles.length;
    let delta = Math.abs(angles[j]! - angles[i]!);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    const minSep = (arcSpans[i]! + arcSpans[j]!) / 2;
    if (delta < minSep * tolerance) return true;
  }
  return false;
}

/** Verify every adjacent pair has at least minGapPx arc clearance. */
export function adjacentPairsMeetGap(
  angles: number[],
  beadArcPx: number[],
  radiusPx: number,
  minGapPx: number,
): boolean {
  if (angles.length < 2) return true;
  for (let i = 0; i < angles.length; i++) {
    const j = (i + 1) % angles.length;
    const clearance = adjacentArcClearancePx(
      angles[i]!,
      beadArcPx[i]!,
      angles[j]!,
      beadArcPx[j]!,
      radiusPx,
    );
    if (clearance < minGapPx - 0.01) return false;
  }
  return true;
}

/** @deprecated Use isVisualOverCanvas */
export const isVisualOverCapacity = (r: ResolvedRingRadiusResult) => r.isVisualOverCanvas;
