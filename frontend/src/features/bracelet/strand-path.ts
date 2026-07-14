/**
 * Circular path layout on the bracelet ring.
 * Stage 1: elastic arc-length distribution from strand occupancy.
 * Stage 2: anchor / offset / rotation applied in the renderer (see strand-render-profile).
 */
import type { StrandRenderProfile } from "@bino-foundry/shared/types";

import { resolveStrandRenderProfileBySlug } from "@/render/bead-crop/strand-render-profile";

import { computeElasticBeadLayout } from "./strand-elastic-layout";

/** Default ring start — top of canvas (12 o'clock). */
export const STRAND_PATH_START_ANGLE = -Math.PI / 2;

/** Normalize any radian angle to (-π, π]. */
export function normalizePathAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
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
