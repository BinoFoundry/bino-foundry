import { STRAND_PATH_START_ANGLE } from "./strand-path";
import { netContactLoopArcPx } from "@bino-foundry/shared/types";

export interface ElasticBeadLayout {
  angles: number[];
  arcSpans: number[];
  gapMm: number;
  insertionAngles: number[];
  isOverCapacity: boolean;
}

export interface ContactOverlapPx {
  leadingPx: number[];
  trailingPx: number[];
}

function normalizeAngleRad(a: number): number {
  let x = a % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x;
}

/** Midpoint angle on the ring between two boundary angles (short arc). */
export function midpointAngleRad(a: number, b: number): number {
  const na = normalizeAngleRad(a);
  const nb = normalizeAngleRad(b);
  let delta = nb - na;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return normalizeAngleRad(na + delta / 2);
}

/** Angular distance between consecutive strand indices on a closed loop. */
export function adjacentIndexAngleDeltaRad(angles: number[], index: number): number {
  const n = angles.length;
  if (n < 2) return 0;
  const curr = normalizeAngleRad(angles[index]!);
  const next = normalizeAngleRad(angles[(index + 1) % n]!);
  let delta = next - curr;
  if (delta <= 0) delta += 2 * Math.PI;
  return delta;
}

/**
 * Contact-geometry packing — each bead occupies contactArcPx along the strand.
 * Junction spacing: prev.contact - prev.trailingOverlap + current.leadingOverlap.
 * Remaining circumference (if any) stays at the loop closure only — never between neighbours.
 */
function packContactArcLayout(
  contactArcPx: number[],
  leadingOverlapPx: number[],
  trailingOverlapPx: number[],
  layoutCircumferencePx: number,
  startAngle: number,
  minGapPx: number,
): { angles: number[]; arcSpans: number[] } {
  const n = contactArcPx.length;
  const layoutCircumference = Math.max(layoutCircumferencePx, 1e-6);

  let cursorPx = 0;
  const angles: number[] = [];
  const arcSpans: number[] = [];

  for (let i = 0; i < n; i++) {
    const arcPx = contactArcPx[i]!;
    if (i > 0) {
      cursorPx -= trailingOverlapPx[i - 1]! + leadingOverlapPx[i]!;
    }
    const centerPx = cursorPx + arcPx / 2;
    angles.push(
      normalizeAngleRad(startAngle + (centerPx / layoutCircumference) * 2 * Math.PI),
    );
    arcSpans.push((arcPx / layoutCircumference) * 2 * Math.PI);
    cursorPx += arcPx + minGapPx;
  }

  return { angles, arcSpans };
}

/**
 * Sequential arc-length packing — bead i+1 follows bead i around the ring.
 * Neighbours are edge-to-edge; any spare circumference remains at the loop closure.
 */
function packSequentialArcLayout(
  beadArcMm: number[],
  layoutCircumferenceMm: number,
  startAngle: number,
  minGapPx: number,
): { angles: number[]; arcSpans: number[] } {
  const n = beadArcMm.length;
  const layoutCircumference = Math.max(layoutCircumferenceMm, 1e-6);

  let cursorMm = 0;
  const angles: number[] = [];
  const arcSpans: number[] = [];

  for (let i = 0; i < n; i++) {
    const mm = beadArcMm[i]!;
    const centerMm = cursorMm + mm / 2;
    angles.push(
      normalizeAngleRad(startAngle + (centerMm / layoutCircumference) * 2 * Math.PI),
    );
    arcSpans.push((mm / layoutCircumference) * 2 * Math.PI);
    cursorMm += mm + minGapPx;
  }

  return { angles, arcSpans };
}

/** True when any adjacent pair overlaps beyond tolerance (radians). */
export function adjacentArcSectorsOverlap(
  angles: number[],
  arcSpans: number[],
  tolerance = 1,
): boolean {
  if (angles.length < 2) return false;
  for (let i = 0; i < angles.length; i++) {
    const j = (i + 1) % angles.length;
    const delta = adjacentIndexAngleDeltaRad(angles, i);
    const minSep = (arcSpans[i]! + arcSpans[j]!) / 2;
    if (delta + 1e-6 < minSep * tolerance) return true;
  }
  return false;
}

/**
 * Elastic arc-length distribution along a wrist-sized circumference.
 * When `contactOverlaps` is provided, uses contact geometry junction spacing.
 */
export function computeElasticBeadLayout(
  beadArcMm: number[],
  layoutCircumferenceMm: number,
  startAngle = STRAND_PATH_START_ANGLE,
  minGapPx = 0,
  contactOverlaps?: ContactOverlapPx,
): ElasticBeadLayout {
  const n = beadArcMm.length;
  if (!n || layoutCircumferenceMm <= 0) {
    return {
      angles: [],
      arcSpans: [],
      gapMm: 0,
      insertionAngles: [startAngle],
      isOverCapacity: false,
    };
  }

  const leadingPx = contactOverlaps?.leadingPx ?? new Array<number>(n).fill(0);
  const trailingPx = contactOverlaps?.trailingPx ?? new Array<number>(n).fill(0);
  const usesContactPacking = contactOverlaps != null;

  const totalBeadMm = usesContactPacking
    ? netContactLoopArcPx(beadArcMm, leadingPx, trailingPx)
    : beadArcMm.reduce((sum, mm) => sum + mm, 0);
  const minTotalGap = n * minGapPx;
  const isOverCapacity = totalBeadMm + minTotalGap > layoutCircumferenceMm + 1e-6;
  const gapMm = 0;

  const angles: number[] = [];
  const arcSpans: number[] = [];

  if (isOverCapacity) {
    let cursorMm = 0;
    for (let i = 0; i < n; i++) {
      const arcMm = (beadArcMm[i]! / totalBeadMm) * layoutCircumferenceMm;
      const centerMm = cursorMm + arcMm / 2;
      angles.push(
        normalizeAngleRad(startAngle + (centerMm / layoutCircumferenceMm) * 2 * Math.PI),
      );
      arcSpans.push((arcMm / layoutCircumferenceMm) * 2 * Math.PI);
      cursorMm += arcMm;
    }
  } else if (n === 1) {
    const mm = beadArcMm[0]!;
    angles.push(normalizeAngleRad(startAngle));
    arcSpans.push((mm / layoutCircumferenceMm) * 2 * Math.PI);
  } else if (usesContactPacking) {
    const packed = packContactArcLayout(
      beadArcMm,
      leadingPx,
      trailingPx,
      layoutCircumferenceMm,
      startAngle,
      minGapPx,
    );
    angles.push(...packed.angles);
    arcSpans.push(...packed.arcSpans);
  } else {
    const packed = packSequentialArcLayout(beadArcMm, layoutCircumferenceMm, startAngle, minGapPx);
    angles.push(...packed.angles);
    arcSpans.push(...packed.arcSpans);
  }

  const insertionAngles: number[] = [];
  if (n === 1) {
    const beadAngle = angles[0]!;
    const span = arcSpans[0]!;
    const halfEmpty = (2 * Math.PI - span) / 2;
    insertionAngles.push(normalizeAngleRad(beadAngle - span / 2 - halfEmpty / 2));
    insertionAngles.push(normalizeAngleRad(beadAngle + span / 2 + halfEmpty / 2));
  } else {
    for (let i = 0; i <= n; i++) {
      if (i === 0) {
        const last = angles[n - 1]!;
        const lastSpan = arcSpans[n - 1]!;
        const first = angles[0]!;
        const firstSpan = arcSpans[0]!;
        insertionAngles.push(
          midpointAngleRad(last + lastSpan / 2, first - firstSpan / 2),
        );
      } else if (i === n) {
        const prev = angles[n - 1]!;
        const prevSpan = arcSpans[n - 1]!;
        const first = angles[0]!;
        const firstSpan = arcSpans[0]!;
        insertionAngles.push(
          midpointAngleRad(prev + prevSpan / 2, first - firstSpan / 2),
        );
      } else {
        const prev = angles[i - 1]!;
        const prevSpan = arcSpans[i - 1]!;
        const curr = angles[i]!;
        const currSpan = arcSpans[i]!;
        insertionAngles.push(
          midpointAngleRad(prev + prevSpan / 2, curr - currSpan / 2),
        );
      }
    }
  }

  return { angles, arcSpans, gapMm, insertionAngles, isOverCapacity };
}

export interface LayoutAngleSector {
  index: number;
  angle: number;
  arcSpan: number;
}

export function beadIndexFromLayoutSectors(
  pointerAngle: number,
  sectors: LayoutAngleSector[],
): number {
  if (!sectors.length) return 0;
  const target = normalizeAngleRad(pointerAngle);

  let bestIdx = sectors[0]!.index;
  let bestDist = Infinity;

  for (const sector of sectors) {
    const center = normalizeAngleRad(sector.angle);
    const half = sector.arcSpan / 2;
    let dist = Math.abs(target - center);
    if (dist > Math.PI) dist = 2 * Math.PI - dist;
    if (dist <= half + 0.001 && dist < bestDist) {
      bestDist = dist;
      bestIdx = sector.index;
    }
  }

  if (bestDist === Infinity) {
    for (const sector of sectors) {
      const center = normalizeAngleRad(sector.angle);
      let dist = Math.abs(target - center);
      if (dist > Math.PI) dist = 2 * Math.PI - dist;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = sector.index;
      }
    }
  }

  return bestIdx;
}

export function insertionIndexFromLayoutGaps(
  pointerAngle: number,
  insertionAngles: number[],
): number {
  if (insertionAngles.length <= 1) return 0;
  const target = normalizeAngleRad(pointerAngle);
  let bestIdx = 0;
  let bestDist = Infinity;
  insertionAngles.forEach((angle, i) => {
    const gap = normalizeAngleRad(angle);
    let dist = Math.abs(target - gap);
    if (dist > Math.PI) dist = 2 * Math.PI - dist;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  });
  return bestIdx;
}

export function angularDistanceRad(a: number, b: number): number {
  const delta = Math.abs(normalizeAngleRad(a) - normalizeAngleRad(b));
  return Math.min(delta, 2 * Math.PI - delta);
}

export type StrandInsertTarget = { mode: "insert"; index: number };

/** Nearest gap insertion index only (no bead replacement). */
export function resolveLibraryInsertTarget(
  pointerAngle: number,
  insertionAngles: number[],
): StrandInsertTarget {
  return {
    mode: "insert",
    index: insertionIndexFromLayoutGaps(pointerAngle, insertionAngles),
  };
}

export function resolveDropTargetFromLayout(
  pointerAngle: number,
  sectors: LayoutAngleSector[],
  insertionAngles: number[],
): { mode: "insert" | "replace"; index: number } {
  if (!sectors.length) return { mode: "insert", index: 0 };

  const beadIdx = beadIndexFromLayoutSectors(pointerAngle, sectors);
  const insertIdx = insertionIndexFromLayoutGaps(pointerAngle, insertionAngles);
  const beadAngle = sectors.find((s) => s.index === beadIdx)?.angle ?? pointerAngle;
  const gapAngle = insertionAngles[insertIdx] ?? pointerAngle;
  const toBead = angularDistanceRad(pointerAngle, beadAngle);
  const toGap = angularDistanceRad(pointerAngle, gapAngle);

  if (toBead <= toGap * 0.9) {
    return { mode: "replace", index: beadIdx };
  }
  return { mode: "insert", index: insertIdx };
}

/** Convert rendered pixel extent to equivalent arc mm on the wrist circumference. */
export function visualArcMmFromExtent(
  extentPx: number,
  radiusPx: number,
  layoutCircumferenceMm: number,
): number {
  if (radiusPx <= 0 || extentPx <= 0) return 0;
  const circumferencePx = 2 * Math.PI * radiusPx;
  return (extentPx / circumferencePx) * layoutCircumferenceMm;
}
