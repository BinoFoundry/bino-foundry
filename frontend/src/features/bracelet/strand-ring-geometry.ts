import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import {
  getBeadSlotDimensions,
  getBeadTangentArcPx,
  getMaxSlotExtent,
  getBeadStrandTangentContactPx,
  resolveBeadSlotSizing,
  resolveStrandRenderConfigForBead,
  type BeadSlotDimensions,
  type BeadSlotSizingCatalogueContext,
  type BeadSlotSizingResult,
  type StrandRenderCatalogueContext,
} from "@/render/bead-crop";
import {
  contactArcPxFromSlotWidth,
  contactGeometryFromProfile,
  netContactLoopArcPx,
  type ContactArcPx,
  type StrandLayoutGeometry,
} from "@bino-foundry/shared/types";
import type { StrandRenderProfile } from "@bino-foundry/shared/types";

import { normalizeFromSlots } from "./composition";

import { computeMaxRingRadiusPx, computeWristRingRadiusPx, type WristSizeBounds } from "./strand-ring";
import { STRAND_LAYOUT_BASELINE_PX } from "./strand-viewport";

/** Continuous bracelet — no inter-bead gaps at layout scale factor 1. */
export const BEAD_PAIR_GAP_BASE_PX = 0;

/** No bleed padding — spacing comes from contact geometry only. */
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

export type { ContactArcPx, StrandLayoutGeometry };

export { contactGeometryFromProfile };

/**
 * Tangential contact arc from visible strand silhouette — not wrapper or PNG padding.
 */
export function beadContactArcPxFromSizing(
  sizing: Pick<
    BeadSlotSizingResult,
    | "dimensions"
    | "visibleContentWidthPx"
    | "visibleContentDiameterPx"
    | "actualVisibleDiameterPx"
    | "isRoundVisualBead"
    | "exportFillRatio"
  >,
  profile: Pick<
    StrandRenderProfile,
    | "contactWidth"
    | "contactOffset"
    | "spacingAdjustment"
    | "leadingOverlap"
    | "trailingOverlap"
    | "collisionPadding"
  >,
  scaleFactor = 1,
): ContactArcPx {
  const contactBasePx = getBeadStrandTangentContactPx(sizing);
  return contactArcPxFromSlotWidth(contactBasePx, profile, scaleFactor);
}

/**
 * @deprecated Use beadContactArcPxFromSizing — layout no longer uses bitmap footprint.
 */
export function beadStrandFootprintPx(
  sizing: Pick<
    BeadSlotSizingResult,
    "dimensions" | "visibleContentWidthPx" | "visibleContentDiameterPx" | "imageRenderWidthPx"
  >,
  profile?: Pick<
    StrandRenderProfile,
    "contactWidth" | "strandOccupancy" | "forceRoundFootprint" | "collisionPadding"
  >,
): number {
  const slotWidthPx = getBeadTangentArcPx(sizing.dimensions);
  const contactWidth = profile?.contactWidth ?? profile?.strandOccupancy ?? 1;
  return contactWidth * slotWidthPx;
}

/** Strand contact arc from mm slot width and contact geometry profile. */
export function beadLayoutArcPx(
  dim: BeadSlotDimensions,
  scaleFactor: number,
  profile?: Pick<
    StrandRenderProfile,
    | "contactWidth"
    | "contactOffset"
    | "spacingAdjustment"
    | "leadingOverlap"
    | "trailingOverlap"
    | "collisionPadding"
  >,
): number {
  return beadLayoutArcPxFromSizing(
    { dimensions: dim },
    profile ?? {
      contactWidth: 1,
      contactOffset: 0,
      spacingAdjustment: 0,
      leadingOverlap: 0,
      trailingOverlap: 0,
      collisionPadding: 0,
    },
    scaleFactor,
  );
}

export function beadLayoutArcPxFromSizing(
  sizing: Pick<BeadSlotSizingResult, "dimensions">,
  profile?: Pick<
    StrandRenderProfile,
    | "contactWidth"
    | "contactOffset"
    | "spacingAdjustment"
    | "leadingOverlap"
    | "trailingOverlap"
    | "collisionPadding"
  >,
  scaleFactor = 1,
): number {
  return beadContactArcPxFromSizing(
    sizing,
    profile ?? {
      contactWidth: 1,
      contactOffset: 0,
      spacingAdjustment: 0,
      leadingOverlap: 0,
      trailingOverlap: 0,
      collisionPadding: 0,
    },
    scaleFactor,
  ).contactArcPx;
}

/** Build per-bead contact arc + overlap arrays for the layout packer. */
export function beadContactLayoutArrays(
  sizingResults: Pick<
    BeadSlotSizingResult,
    | "dimensions"
    | "visibleContentWidthPx"
    | "visibleContentDiameterPx"
    | "actualVisibleDiameterPx"
    | "isRoundVisualBead"
    | "exportFillRatio"
  >[],
  profiles: Pick<
    StrandRenderProfile,
    | "contactWidth"
    | "contactOffset"
    | "spacingAdjustment"
    | "leadingOverlap"
    | "trailingOverlap"
    | "collisionPadding"
  >[],
  scaleFactor = 1,
): {
  contactArcPx: number[];
  leadingOverlapPx: number[];
  trailingOverlapPx: number[];
} {
  const contactArcPx: number[] = [];
  const leadingOverlapPx: number[] = [];
  const trailingOverlapPx: number[] = [];

  for (let i = 0; i < sizingResults.length; i++) {
    const contact = beadContactArcPxFromSizing(
      sizingResults[i]!,
      profiles[i] ?? {
        contactWidth: 1,
        contactOffset: 0,
        spacingAdjustment: 0,
        leadingOverlap: 0,
        trailingOverlap: 0,
        collisionPadding: 0,
      },
      scaleFactor,
    );
    contactArcPx.push(contact.contactArcPx);
    leadingOverlapPx.push(contact.leadingOverlapPx);
    trailingOverlapPx.push(contact.trailingOverlapPx);
  }

  return { contactArcPx, leadingOverlapPx, trailingOverlapPx };
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
  /**
   * Always false — wrist size fixes the ring. Over-capacity compression (not growth)
   * finishes a full bracelet on the same circumference.
   * @deprecated Kept for callers; ring no longer auto-expands.
   */
  expanded: boolean;
  /** True when the wrist ring exceeds available canvas radius (zoom/pan may help). */
  isVisualOverCanvas: boolean;
  /** Contact arcs require more than the wrist circumference (layout will compress). */
  isOverWristCapacity: boolean;
  beadArcPx: number[];
  leadingOverlapPx: number[];
  trailingOverlapPx: number[];
  pairGapPx: number;
}

/**
 * Resolve ring radius from the wrist baseline only.
 * Beads pack contiguously on that ring; spare length stays as one empty arc.
 * When contact arcs exceed the wrist circumference, keep the wrist radius and
 * let the elastic packer compress proportionally (do not grow the bracelet).
 */
export function computeResolvedRingRadiusPx(params: {
  beadLayoutArcPx: number[];
  leadingOverlapPx?: number[];
  trailingOverlapPx?: number[];
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
  const leadingOverlapPx =
    params.leadingOverlapPx?.length === n
      ? params.leadingOverlapPx
      : new Array<number>(n).fill(0);
  const trailingOverlapPx =
    params.trailingOverlapPx?.length === n
      ? params.trailingOverlapPx
      : new Array<number>(n).fill(0);

  const radiusPx = Math.max(1, wristRadiusPx);

  if (!n) {
    return {
      radiusPx,
      expanded: false,
      isVisualOverCanvas: false,
      isOverWristCapacity: false,
      beadArcPx: [],
      leadingOverlapPx: [],
      trailingOverlapPx: [],
      pairGapPx,
    };
  }

  const beadArcPx: number[] = layoutArcs.map(beadArcPxOnRing);
  const totalArcPx =
    netContactLoopArcPx(beadArcPx, leadingOverlapPx, trailingOverlapPx) + n * pairGapPx;
  const wristCircumferencePx = 2 * Math.PI * radiusPx;
  const isOverWristCapacity = totalArcPx > wristCircumferencePx + 1e-6;
  const isVisualOverCanvas = radiusPx > maxRadiusPx + 0.5;

  return {
    radiusPx,
    expanded: false,
    isVisualOverCanvas,
    isOverWristCapacity,
    beadArcPx,
    leadingOverlapPx,
    trailingOverlapPx,
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
 * Shared wrist-baseline ring resolution for renderer and UI hints.
 * Wrist size fixes the ring radius; beads pack contiguously without growing the bracelet.
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
  const profiles = normalized.map((p) =>
    resolveStrandRenderConfigForBead(p.bead, renderCatalogue),
  );
  const contactArrays = beadContactLayoutArrays(sizingResults, profiles, scaleFactor);
  const resolved = computeResolvedRingRadiusPx({
    beadLayoutArcPx: contactArrays.contactArcPx,
    leadingOverlapPx: contactArrays.leadingOverlapPx,
    trailingOverlapPx: contactArrays.trailingOverlapPx,
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
  junctionOverlapPx = 0,
): number {
  let delta = Math.abs(angleB - angleA);
  if (delta > Math.PI) delta = 2 * Math.PI - delta;
  const centerDistPx = delta * radiusPx;
  return centerDistPx - arcPxA / 2 - arcPxB / 2 + junctionOverlapPx;
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
  leadingOverlapPx: number[] = [],
  trailingOverlapPx: number[] = [],
): boolean {
  if (angles.length < 2) return true;
  const pairCount = closedLoop ? angles.length : angles.length - 1;
  for (let i = 0; i < pairCount; i++) {
    const j = (i + 1) % angles.length;
    const junctionOverlap =
      trailingOverlapPx[i]! + leadingOverlapPx[j]!;
    const clearance = adjacentArcClearancePx(
      angles[i]!,
      beadArcPx[i]!,
      angles[j]!,
      beadArcPx[j]!,
      radiusPx,
      junctionOverlap,
    );
    if (clearance < minGapPx - 0.01) return false;
  }
  return true;
}

/** @deprecated Use isVisualOverCanvas */
export const isVisualOverCapacity = (r: ResolvedRingRadiusResult) => r.isVisualOverCanvas;
