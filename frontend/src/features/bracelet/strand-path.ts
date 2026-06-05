/**
 * Circular path layout: even polar positioning on the bracelet ring.
 * Position: θᵢ = (360° / n) × i (+ 12 o'clock start offset).
 * Rotation: tangent to the cord at θᵢ (visual orientation only — independent of θ formula).
 */

/** Default ring start — top of canvas (12 o'clock). */
export const STRAND_PATH_START_ANGLE = -Math.PI / 2;

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

/** Per-type fine-tune after path rotation (e.g. charm bail orientation). */
export function beadTypeRotationOffsetDeg(beadTypeSlug?: string): number {
  switch (beadTypeSlug) {
    case "charm":
      return 0;
    case "spacer":
      return 0;
    default:
      return 0;
  }
}

/**
 * Place beads on a circular path with even angular distribution.
 * When n changes, every θᵢ is recomputed: θᵢ = (360° / n) × i.
 */
export function computeStrandPathLayout(params: {
  beads: StrandPathBeadInput[];
  /** @deprecated Ignored for even distribution; kept for call-site compatibility. */
  layoutCircumferenceMm?: number;
  centerX: number;
  centerY: number;
  radius: number;
  startAngle?: number;
  rotationOffsetByIndex?: (index: number) => number;
}): StrandPathBeadLayout[] {
  const {
    beads,
    centerX,
    centerY,
    radius,
    startAngle = STRAND_PATH_START_ANGLE,
    rotationOffsetByIndex,
  } = params;

  const n = beads.length;
  if (!n || radius <= 0) return [];

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
