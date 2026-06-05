/**
 * Circular strand layout: even polar distribution + viewport scaling helpers.
 */

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

/** Even polar angles for a bead sequence; insertion sits between last and first on the ring. */
export function computeSequenceLayoutAngles(
  beadMm: number[],
  _layoutCircumferenceMm?: number,
): { beadAngles: number[]; insertionAngle: number } {
  const n = beadMm.length;
  if (!n) {
    return { beadAngles: [], insertionAngle: STRAND_PATH_START_ANGLE };
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
  beadIndexFromPointerAngle,
  findNearestBeadIndexByAngle,
  pointerAngleOnCanvas,
  STRAND_PATH_START_ANGLE,
  type StrandPathBeadInput,
  type StrandPathBeadLayout,
} from "./strand-path";

/** @deprecated Prefer `evenBeadAngleRad` — even distribution ignores mm weights. */
export function computeWeightedSlotAngles(slots: StrandSlotLayoutInput[]): number[] {
  return slots.map((slot) => evenBeadAngleRad(slot.index, slots.length));
}
