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

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   points: PathAnchor[],
 *   layerOrder?: 'behind' | 'inside' | 'front',
 *   opacity?: number,
 *   depth?: number,
 *   visible?: boolean,
 *   notes?: string,
 *   holes?: LensPolygon[],
 *   shapePreset?: 'rectangle' | 'ellipse' | 'free',
 *   shapeBaseline?: PathAnchor[],
 * }} LensPolygon
 *
 * `holes` — inner polygons for compound glass occluders (even-odd fill). Outer path = `points`.
 * `shapePreset` — Manual Detail / cutout setup preset (Circle≈ellipse, Rectangle, Free).
 * `shapeBaseline` — last transform-clean geometry for Reset Shape (vertex edits do not update it).
 */

/**
 * @typedef {{
 *   left?: LensPolygon[],
 *   right?: LensPolygon[]
 * }} LensExclusionsBySide
 */

/**
 * @typedef {{
 *   version: number,
 *   imageWidth: number,
 *   imageHeight: number,
 *   lenses: LensPolygon[],
 *   frameExclusions?: LensPolygon[],
 *   exclusions?: LensExclusionsBySide,
 *   updatedAt: number
 * }} MaskConfig
 *
 * `frameExclusions` is the canonical frame-level structure-object list.
 * `exclusions` (by-side) is legacy and only read for backward compatibility.
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
 * @param {LensExclusionsBySide | null | undefined} [exclusions] Legacy by-side exclusions.
 * @param {LensPolygon[] | null | undefined} [frameExclusions] Frame-level exclusions.
 * @returns {MaskConfig}
 */
export function createMaskConfig(
  width,
  height,
  lenses,
  exclusions = undefined,
  frameExclusions = undefined,
) {
  const normalizedExclusions = normalizeExclusionsBySide(exclusions);
  const normalizedFrameExclusions = normalizeFrameExclusions(frameExclusions);
  return {
    version: MASK_CONFIG_VERSION,
    imageWidth: width,
    imageHeight: height,
    lenses: lenses.map((l) => ({
      id: l.id,
      label: l.label,
      points: migrateAnchors(l.points),
    })),
    ...(normalizedFrameExclusions ? { frameExclusions: normalizedFrameExclusions } : {}),
    ...(normalizedExclusions ? { exclusions: normalizedExclusions } : {}),
    updatedAt: Date.now(),
  };
}

/**
 * Normalize a flat frame-level exclusion list.
 * @param {LensPolygon[] | null | undefined} list
 * @returns {LensPolygon[] | null}
 */
export function normalizeFrameExclusions(list) {
  if (!Array.isArray(list)) return null;
  const normalized = list.map(normalizeExclusionPolygon).filter(Boolean);
  return normalized.length ? normalized : null;
}

/**
 * Merge frame-level exclusions with legacy by-side exclusions into one flat list.
 * @param {MaskConfig | null | undefined} mask
 * @returns {LensPolygon[]}
 */
export function resolveMaskFrameExclusions(mask) {
  if (!mask || typeof mask !== "object") return [];
  const out = [];
  const seen = new Set();
  const push = (polygon) => {
    const normalized = normalizeExclusionPolygon(polygon);
    if (!normalized) return;
    let id = normalized.id;
    while (seen.has(id)) id = `${id}-${out.length}`;
    seen.add(id);
    out.push({ ...normalized, id });
  };
  for (const polygon of mask.frameExclusions ?? []) push(polygon);
  for (const polygon of mask.exclusions?.left ?? []) push(polygon);
  for (const polygon of mask.exclusions?.right ?? []) push(polygon);
  return out;
}

/** @param {LensExclusionsBySide | null | undefined} exclusions */
export function normalizeExclusionsBySide(exclusions) {
  if (!exclusions || typeof exclusions !== "object") return null;
  const left = exclusions.left?.map(normalizeExclusionPolygon).filter(Boolean) ?? [];
  const right = exclusions.right?.map(normalizeExclusionPolygon).filter(Boolean) ?? [];
  if (!left.length && !right.length) return null;
  return {
    ...(left.length ? { left } : {}),
    ...(right.length ? { right } : {}),
  };
}

/**
 * @param {Partial<LensPolygon> | null | undefined} polygon
 * @param {number} [index]
 */
function normalizeHolePolygon(polygon, index = 0) {
  if (!polygon || typeof polygon !== "object") return null;
  const points = migrateAnchors(polygon.points ?? []);
  const rawId = typeof polygon.id === "string" ? polygon.id.trim() : "";
  // Older payloads sometimes omitted hole ids — keep geometry rather than dropping the cutout.
  if (!rawId && points.length < 1) return null;
  const shapePreset =
    polygon.shapePreset === "rectangle" ||
    polygon.shapePreset === "ellipse" ||
    polygon.shapePreset === "free"
      ? polygon.shapePreset
      : undefined;
  const shapeBaseline = Array.isArray(polygon.shapeBaseline)
    ? migrateAnchors(polygon.shapeBaseline)
    : undefined;
  return {
    id: rawId || `hole-${index + 1}`,
    label: polygon.label || "Hole",
    points,
    notes: typeof polygon.notes === "string" ? polygon.notes : "",
    ...(shapePreset ? { shapePreset } : {}),
    ...(shapeBaseline?.length ? { shapeBaseline } : {}),
  };
}

/** @param {LensPolygon} polygon */
function normalizeExclusionPolygon(polygon) {
  if (!polygon?.id) return null;
  const layerOrder =
    polygon.layerOrder === "inside" || polygon.layerOrder === "front" || polygon.layerOrder === "behind"
      ? polygon.layerOrder
      : "behind";
  const opacity =
    typeof polygon.opacity === "number" && Number.isFinite(polygon.opacity)
      ? Math.max(0, Math.min(100, polygon.opacity))
      : 100;
  const depth =
    typeof polygon.depth === "number" && Number.isFinite(polygon.depth)
      ? Math.max(0, Math.min(100, polygon.depth))
      : 50;
  const holes = Array.isArray(polygon.holes)
    ? polygon.holes
        .map((hole, index) => normalizeHolePolygon(hole, index))
        .filter(Boolean)
    : [];
  const shapePreset =
    polygon.shapePreset === "rectangle" ||
    polygon.shapePreset === "ellipse" ||
    polygon.shapePreset === "free"
      ? polygon.shapePreset
      : undefined;
  const shapeBaseline = Array.isArray(polygon.shapeBaseline)
    ? migrateAnchors(polygon.shapeBaseline)
    : undefined;
  return {
    id: polygon.id,
    label: polygon.label || "Frame part",
    points: migrateAnchors(polygon.points ?? []),
    layerOrder,
    opacity,
    depth,
    visible: polygon.visible !== false,
    notes: typeof polygon.notes === "string" ? polygon.notes : "",
    holes,
    ...(shapePreset ? { shapePreset } : {}),
    ...(shapeBaseline?.length ? { shapeBaseline } : {}),
  };
}

/**
 * @param {string} id
 * @param {string} label
 * @param {PathAnchor[]} [points]
 * @param {Partial<Pick<LensPolygon, 'layerOrder' | 'opacity' | 'depth' | 'visible' | 'notes' | 'holes' | 'shapePreset' | 'shapeBaseline'>>} [extras]
 * @returns {LensPolygon}
 */
export function createLensPolygon(id, label, points = [], extras = {}) {
  return (
    normalizeExclusionPolygon({
      id,
      label,
      points,
      layerOrder: extras.layerOrder ?? "behind",
      opacity: extras.opacity ?? 100,
      depth: extras.depth ?? 50,
      visible: extras.visible !== false,
      notes: extras.notes ?? "",
      holes: extras.holes ?? [],
      shapePreset: extras.shapePreset,
      shapeBaseline: extras.shapeBaseline,
    }) ?? {
      id,
      label,
      points: migrateAnchors(points),
      layerOrder: "behind",
      opacity: 100,
      depth: 50,
      visible: true,
      notes: "",
      holes: [],
    }
  );
}

export function defaultLensSet() {
  return [
    createLensPolygon('left', 'Left lens', []),
    createLensPolygon('right', 'Right lens', []),
  ];
}

/** Keep left + right lens slots even when saved data only has one path. */
export function ensureFrameLensSet(lenses: LensPolygon[]): LensPolygon[] {
  return defaultLensSet().map((def) => {
    const existing = lenses.find((l) => l.id === def.id);
    if (!existing) return def;
    return {
      id: def.id,
      label: existing.label || def.label,
      points: migrateAnchors(existing.points),
    };
  });
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
