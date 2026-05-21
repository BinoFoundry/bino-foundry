/** @typedef {{ x: number, y: number }} NormPoint — 0–1 relative to image size */

/**
 * Anchor with optional Bézier handles (normalized coords).
 * `curved`: segment from this anchor → next anchor is a cubic curve.
 * @typedef {{
 *   x: number,
 *   y: number,
 *   curved?: boolean,
 *   handleIn?: NormPoint | null,
 *   handleOut?: NormPoint | null,
 * }} PathAnchor
 */

/** @typedef {{
 *   id: string,
 *   label: string,
 *   points: PathAnchor[]
 * }} LensPolygon */

/**
 * @typedef {{
 *   version: number,
 *   imageWidth: number,
 *   imageHeight: number,
 *   lenses: LensPolygon[],
 *   updatedAt: number
 * }} MaskConfig
 */

export const MASK_CONFIG_VERSION = 2;

/**
 * @param {Partial<PathAnchor> & { x: number, y: number }} p
 * @returns {PathAnchor}
 */
export function normalizeAnchor(p) {
  return {
    x: clamp01(p.x),
    y: clamp01(p.y),
    curved: Boolean(p.curved),
    handleIn: p.handleIn ? { x: clamp01(p.handleIn.x), y: clamp01(p.handleIn.y) } : null,
    handleOut: p.handleOut ? { x: clamp01(p.handleOut.x), y: clamp01(p.handleOut.y) } : null,
  };
}

/** Upgrade legacy {x,y}[] points to path anchors. */
export function migrateAnchors(points) {
  if (!points?.length) return [];
  return points.map((p) => {
    if ('curved' in p || p.handleIn || p.handleOut) return normalizeAnchor(p);
    return normalizeAnchor({ x: p.x, y: p.y, curved: false, handleIn: null, handleOut: null });
  });
}

/**
 * @param {number} width
 * @param {number} height
 * @param {LensPolygon[]} lenses
 * @returns {MaskConfig}
 */
export function createMaskConfig(width, height, lenses) {
  return {
    version: MASK_CONFIG_VERSION,
    imageWidth: width,
    imageHeight: height,
    lenses: lenses.map((l) => ({
      id: l.id,
      label: l.label,
      points: migrateAnchors(l.points),
    })),
    updatedAt: Date.now(),
  };
}

export function createLensPolygon(id, label, points = []) {
  return { id, label, points: migrateAnchors(points) };
}

export function defaultLensSet() {
  return [
    createLensPolygon('left', 'Left lens', []),
    createLensPolygon('right', 'Right lens', []),
  ];
}

export function isMaskConfigValid(config) {
  if (!config?.lenses?.length) return false;
  return config.lenses.some((l) => migrateAnchors(l.points).length >= 3);
}

/**
 * @param {PathAnchor} anchor
 * @param {PathAnchor} next
 * @param {number} w
 * @param {number} h
 */
export function defaultHandlesForSegment(anchor, next, w, h) {
  const ax = anchor.x * w;
  const ay = anchor.y * h;
  const nx = next.x * w;
  const ny = next.y * h;
  const mx = (ax + nx) / 2;
  const my = (ay + ny) / 2;
  const dx = nx - ax;
  const dy = ny - ay;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = (-dy / len) * len * 0.12;
  const perpY = (dx / len) * len * 0.12;
  return {
    handleOut: { x: (ax + dx * 0.33 + perpX) / w, y: (ay + dy * 0.33 + perpY) / h },
    handleIn: { x: (nx - dx * 0.33 + perpX) / w, y: (ny - dy * 0.33 + perpY) / h },
  };
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
