/**
 * Circular strand layout: even polar distribution + viewport scaling helpers.
 */

import { computeElasticBeadLayout } from "./strand-elastic-layout";
import {
  computeStrandPathLayout,
  evenBeadAngleRad,
  STRAND_PATH_START_ANGLE,
} from "./strand-path";

export interface StrandSlotLayoutInput {
  index: number;
  weightMm: number;
}

export interface StrandSlotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Uniform scale to expand strand content toward `targetFill` of the canvas (display only).
 * Preserves mm ratios because all slots scale together.
 */
export function computeStrandBboxFillScale(
  slots: StrandSlotBounds[],
  canvasSize: number,
  targetFill: number,
  maxScale: number,
): number {
  if (!slots.length || canvasSize <= 0) return 1;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const s of slots) {
    const hw = s.width / 2;
    const hh = s.height / 2;
    minX = Math.min(minX, s.x - hw);
    maxX = Math.max(maxX, s.x + hw);
    minY = Math.min(minY, s.y - hh);
    maxY = Math.max(maxY, s.y + hh);
  }

  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const scale = Math.min((canvasSize * targetFill) / bw, (canvasSize * targetFill) / bh);
  return Math.max(1, Math.min(scale, maxScale));
}

/** Elastic arc-length angles for a bead sequence on a wrist-sized circumference. */
export function computeSequenceLayoutAngles(
  beadMm: number[],
  layoutCircumferenceMm?: number,
): { beadAngles: number[]; insertionAngle: number } {
  const n = beadMm.length;
  if (!n) {
    return { beadAngles: [], insertionAngle: STRAND_PATH_START_ANGLE };
  }

  if (layoutCircumferenceMm && layoutCircumferenceMm > 0) {
    const elastic = computeElasticBeadLayout(beadMm, layoutCircumferenceMm);
    return {
      beadAngles: elastic.angles,
      insertionAngle: elastic.insertionAngles[0] ?? STRAND_PATH_START_ANGLE,
    };
  }

  const beadAngles = beadMm.map((_, i) => evenBeadAngleRad(i, n));
  const last = beadAngles[n - 1]!;
  const insertionAngle = (last + beadAngles[0]! + 2 * Math.PI) / 2;

  return { beadAngles, insertionAngle };
}

export {
  computeStrandPathLayout,
  polarToCartesian,
  evenBeadAngleRad,
  evenBeadAngleStepRad,
  tangentRotationDeg,
  tangentRotationRad,
  beadTypeRotationOffsetDeg,
  radialOutwardRotationDeg,
  strandRotationDeg,
  beadStrandRotationDeg,
  beadRingAlignOffsetPx,
  applyRingAlignOffset,
  computeBeadShellPosition,
  visualSlotDimensions,
  beadIndexFromPointerAngle,
  insertionAngleRad,
  insertionIndexFromPointerAngle,
  insertionSlotCount,
  resolveStrandDropTarget,
  findNearestBeadIndexByAngle,
  pointerAngleOnCanvas,
  STRAND_PATH_START_ANGLE,
  type StrandDropTarget,
  type StrandPathBeadInput,
  type StrandPathBeadLayout,
} from "./strand-path";

export function computeWeightedSlotAngles(
  slots: StrandSlotLayoutInput[],
  layoutCircumferenceMm?: number,
): number[] {
  if (!layoutCircumferenceMm || layoutCircumferenceMm <= 0) {
    return slots.map((slot) => evenBeadAngleRad(slot.index, slots.length));
  }
  const elastic = computeElasticBeadLayout(
    slots.map((s) => s.weightMm),
    layoutCircumferenceMm,
  );
  return elastic.angles;
}

export {
  computeElasticBeadLayout,
  resolveDropTargetFromLayout,
  visualArcMmFromExtent,
  type ElasticBeadLayout,
  type LayoutAngleSector,
} from "./strand-elastic-layout";
