import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import {
  getBeadSlotDimensions,
  getBeadTangentArcPx,
  getMaxSlotExtent,
  resolveBeadSlotSizing,
  resolveStrandRenderConfigForBead,
  type BeadSlotDimensions,
  type BeadSlotSizingCatalogueContext,
  type BeadSlotSizingResult,
  type StrandRenderCatalogueContext,
} from "@/render/bead-crop";
import type { StrandRenderProfile } from "@bino-foundry/shared/types";

import { normalizeFromSlots } from "./composition";

import { computeMaxRingRadiusPx, computeWristRingRadiusPx, type WristSizeBounds } from "./strand-ring";
import { STRAND_LAYOUT_BASELINE_PX } from "./strand-viewport";

/** Continuous bracelet — no inter-bead gaps at layout scale factor 1. */
export const BEAD_PAIR_GAP_BASE_PX = 0;

/** No bleed padding — occupancy comes from physical footprint only. */
export const BEAD_VISUAL_BLEED_BASE_PX = 0;

export interface BeadSpacingPx {
  pairGapPx: number;
  bleedPx: number;
}

/** Scaled spacing buffers — zero for continuous edge-to-edge layout. */
export function scaledBeadSpacingPx(scaleFactor: number): BeadSpacingPx {
  const sf = Math.max(0.5, scaleFactor);
  return {
    pairGapPx: BEAD_PAIR_GAP_BASE_PX * sf,
    bleedPx: BEAD_VISUAL_BLEED_BASE_PX * sf,
  };
}

/**
 * Tangential footprint used for strand spacing — rendered visible width, not bitmap canvas size.
 * Charms/spacers use attachment occupancy only (dangling art excluded).
 */
export function beadStrandFootprintPx(
  sizing: Pick<
    BeadSlotSizingResult,
    "dimensions" | "visibleContentWidthPx" | "visibleContentDiameterPx" | "imageRenderWidthPx"
  >,
  profile?: Pick<
    StrandRenderProfile,
    "strandOccupancy" | "forceRoundFootprint" | "collisionPadding"
  >,
): number {
  const occupancy = profile?.strandOccupancy ?? 1;
  const wrapperTangent = getBeadTangentArcPx(sizing.dimensions);

  if (profile?.forceRoundFootprint === false || occupancy < 0.99) {
    return wrapperTangent * occupancy;
  }

  const visibleTangent =
    sizing.visibleContentWidthPx ??
    sizing.imageRenderWidthPx ??
    sizing.visibleContentDiameterPx ??
    wrapperTangent;

  return Math.max(wrapperTangent, visibleTangent);
}

/**
 * Strand arc occupancy from rendered footprint and render profile.
 * Adjacent centres are (arcᵢ + arcⱼ) / 2 apart along the ring (edge-to-edge).
 */
export function beadLayoutArcPx(
  dim: BeadSlotDimensions,
  scaleFactor: number,
  profile?: Pick<StrandRenderProfile, "strandOccupancy" | "collisionPadding" | "forceRoundFootprint">,
): number {
  const sizing = {
    dimensions: dim,
    visibleContentWidthPx: dim.width,
    visibleContentDiameterPx: Math.max(dim.width, dim.height),
    imageRenderWidthPx: dim.width,
  };
  return beadLayoutArcPxFromSizing(sizing, profile, scaleFactor);
}

export function beadLayoutArcPxFromSizing(
  sizing: Pick<
    BeadSlotSizingResult,
    "dimensions" | "visibleContentWidthPx" | "visibleContentDiameterPx" | "imageRenderWidthPx"
  >,
  profile?: Pick<
    StrandRenderProfile,
    "strandOccupancy" | "collisionPadding" | "forceRoundFootprint"
  >,
  scaleFactor = 1,
): number {
  const footprint = beadStrandFootprintPx(sizing, profile);
  const padding = (profile?.collisionPadding ?? 0) * Math.max(0.5, scaleFactor);
  const { bleedPx } = scaledBeadSpacingPx(scaleFactor);
  return footprint + bleedPx * 2 + padding;
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
    const totalArcPx = beadArcPx.reduce((sum, arc) => sum + arc, 0) + n * pairGapPx;
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
  renderCatalogue?: StrandRenderCatalogueContext;
}): ResolveStrandRingLayoutResult | null {
  const {
    placed,
    wristSizeCm,
    wristSizeBounds,
    canvasSize,
    guideSizeMm,
    beadScaleBoost = 1,
    renderCatalogue,
  } = params;

  const normalized = normalizeFromSlots(placed);
  if (!normalized.length) return null;

  const center = canvasSize / 2;
  const scaleFactor = (canvasSize / STRAND_LAYOUT_BASELINE_PX) * beadScaleBoost;
  const prelimDims = normalized.map((p) =>
    getBeadSlotDimensions(p, placedBeadSizeMm(p), scaleFactor),
  );
  const sizingResults = normalized.map((p) =>
    resolveBeadSlotSizing(p, placedBeadSizeMm(p), scaleFactor, renderCatalogue),
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
  const beadLayoutArcsPx = sizingResults.map((sizing, i) =>
    beadLayoutArcPxFromSizing(
      sizing,
      resolveStrandRenderConfigForBead(normalized[i]?.bead, renderCatalogue),
      scaleFactor,
    ),
  );
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
  closedLoop = true,
): boolean {
  if (angles.length < 2) return false;
  const pairCount = closedLoop ? angles.length : angles.length - 1;
  for (let i = 0; i < pairCount; i++) {
    const j = (i + 1) % angles.length;
    let delta = Math.abs(angles[j]! - angles[i]!);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    const minSep = (arcSpans[i]! + arcSpans[j]!) / 2;
    // Touching (delta === minSep) is valid for edge-to-edge layout; only true overlap fails.
    if (delta + 1e-6 < minSep * tolerance) return true;
  }
  return false;
}

/** Verify every adjacent pair has at least minGapPx arc clearance. */
export function adjacentPairsMeetGap(
  angles: number[],
  beadArcPx: number[],
  radiusPx: number,
  minGapPx: number,
  closedLoop = true,
): boolean {
  if (angles.length < 2) return true;
  const pairCount = closedLoop ? angles.length : angles.length - 1;
  for (let i = 0; i < pairCount; i++) {
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
