import { createLensPolygon, migrateAnchors, type LensPolygon, type PathAnchor } from "@/render/mask/mask-types";
import { insetClosedPathD } from "@/render/lens-clip/inset-path";
import { lensPolygonToPathD } from "@/render/lens-clip/svg-path-builder";
import { pathDToLensPolygon } from "@/render/lens-clip/clip-to-mask";

export type FramePartStartShape = "rectangle" | "ellipse" | "free";

/** Which path inside a Manual Detail is being edited. */
export type FramePartSubpath = "outer" | number;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function point(x: number, y: number): PathAnchor {
  return { x: clamp01(x), y: clamp01(y), curved: false, handleIn: null, handleOut: null };
}

function mapNormPoint(
  p: { x: number; y: number } | null | undefined,
  map: (x: number, y: number) => { x: number; y: number },
): { x: number; y: number } | null {
  if (!p) return null;
  const next = map(p.x, p.y);
  return { x: clamp01(next.x), y: clamp01(next.y) };
}

function newPartId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Axis-aligned rectangle in normalized plate space (default centered). */
export function rectanglePoints(
  cx = 0.5,
  cy = 0.45,
  halfW = 0.08,
  halfH = 0.04,
): PathAnchor[] {
  return [
    point(cx - halfW, cy - halfH),
    point(cx + halfW, cy - halfH),
    point(cx + halfW, cy + halfH),
    point(cx - halfW, cy + halfH),
  ];
}

/** Approximated ellipse (12 segments) in normalized plate space. */
export function ellipsePoints(
  cx = 0.5,
  cy = 0.45,
  rx = 0.08,
  ry = 0.045,
  segments = 12,
): PathAnchor[] {
  const pts: PathAnchor[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(point(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry));
  }
  return pts;
}

export function createFramePart(
  label: string,
  shape: FramePartStartShape,
  extras?: Partial<
    Pick<LensPolygon, "layerOrder" | "opacity" | "visible" | "depth" | "holes">
  >,
): LensPolygon {
  const id = newPartId("frame-part");
  const points =
    shape === "rectangle" ? rectanglePoints() : shape === "ellipse" ? ellipsePoints() : [];
  const baseline = migrateAnchors(points);
  return createLensPolygon(id, label, points, {
    layerOrder: extras?.layerOrder ?? "front",
    opacity: extras?.opacity ?? 100,
    depth: extras?.depth ?? 50,
    visible: extras?.visible !== false,
    holes: extras?.holes ?? [],
    shapePreset: shape,
    shapeBaseline: baseline.length ? baseline : undefined,
  });
}

/** Copy a lens-opening polygon into a new Manual Detail (outer only — fully editable). */
export function createFramePartFromLensClip(
  lens: LensPolygon,
  label: string,
  extras?: Partial<Pick<LensPolygon, "layerOrder" | "opacity" | "visible" | "depth">>,
): LensPolygon {
  const points = migrateAnchors(lens.points ?? []);
  return createLensPolygon(newPartId("frame-part"), label, points, {
    layerOrder: extras?.layerOrder ?? "front",
    opacity: extras?.opacity ?? 100,
    depth: extras?.depth ?? 50,
    visible: extras?.visible !== false,
    holes: [],
    shapePreset: "free",
    shapeBaseline: points.length ? points : undefined,
  });
}

/** Starting cutout: scaled copy of the outer polygon (editable). */
export function createScaledCutout(
  outer: PathAnchor[],
  label: string,
  scale = 0.72,
): LensPolygon {
  const bounds = pathBounds(outer);
  const points =
    migrateAnchors(outer).length >= 3
      ? scaleAnchors(migrateAnchors(outer), scale, scale, bounds.cx, bounds.cy)
      : rectanglePoints(
          bounds.cx,
          bounds.cy,
          Math.max(0.02, bounds.width * 0.25),
          Math.max(0.015, bounds.height * 0.25),
        );
  const baseline = migrateAnchors(points);
  return createLensPolygon(newPartId("cutout"), label, points, {
    shapePreset: "free",
    shapeBaseline: baseline,
  });
}

/**
 * Cutout from a Rectangle / Circle preset, sized inside the outer bounds.
 * Same editable-path model as Manual Detail presets.
 */
export function createCutoutFromPreset(
  outer: PathAnchor[],
  shape: Exclude<FramePartStartShape, "free">,
  label: string,
  scale = 0.55,
): LensPolygon {
  const bounds = pathBounds(outer);
  const halfW = Math.max(0.012, (bounds.width * scale) / 2);
  const halfH = Math.max(0.01, (bounds.height * scale) / 2);
  const points =
    shape === "rectangle"
      ? rectanglePoints(bounds.cx, bounds.cy, halfW, halfH)
      : ellipsePoints(bounds.cx, bounds.cy, halfW, halfH);
  const baseline = migrateAnchors(points);
  return createLensPolygon(newPartId("cutout"), label, points, {
    shapePreset: shape,
    shapeBaseline: baseline,
  });
}

/** Duplicate an existing cutout with a slight offset so it is visible as a new shape. */
export function duplicateCutout(hole: LensPolygon, label?: string): LensPolygon {
  const points = translateAnchors(migrateAnchors(hole.points ?? []), 0.02, 0.02);
  const baseline = hole.shapeBaseline?.length
    ? translateAnchors(migrateAnchors(hole.shapeBaseline), 0.02, 0.02)
    : migrateAnchors(points);
  return createLensPolygon(newPartId("cutout"), label ?? hole.label ?? "Cutout", points, {
    shapePreset: hole.shapePreset,
    shapeBaseline: baseline,
  });
}

/**
 * Generate an inset hole from the outer polygon (pixel inset toward centroid).
 * Uses the same inset helper as Automatic Inner Frame — result stays editable.
 */
export function createInsetCutoutFromOuter(
  outer: PathAnchor[],
  imageWidth: number,
  imageHeight: number,
  insetPx: number,
  label = "Cutout",
): LensPolygon | null {
  if (!(insetPx > 0) || !(imageWidth > 0) || !(imageHeight > 0)) return null;
  const anchors = migrateAnchors(outer);
  if (anchors.length < 3) return null;
  const pathD = lensPolygonToPathD(
    { id: "tmp", label: "tmp", points: anchors },
    imageWidth,
    imageHeight,
  );
  const insetD = insetClosedPathD(pathD, insetPx);
  if (!insetD) return null;
  const hole = pathDToLensPolygon(
    { id: newPartId("cutout"), label, pathD: insetD },
    imageWidth,
    imageHeight,
  );
  if (!hole) return null;
  return {
    ...hole,
    shapePreset: "free" as const,
    shapeBaseline: migrateAnchors(hole.points ?? []),
  };
}

export function getSubpathPoints(part: LensPolygon, subpath: FramePartSubpath): PathAnchor[] {
  if (subpath === "outer") return migrateAnchors(part.points ?? []);
  const hole = part.holes?.[subpath];
  return migrateAnchors(hole?.points ?? []);
}

export function setSubpathPoints(
  part: LensPolygon,
  subpath: FramePartSubpath,
  points: PathAnchor[],
  holesOverride?: LensPolygon[],
): LensPolygon {
  if (subpath === "outer") {
    return {
      ...part,
      points: migrateAnchors(points),
      holes: holesOverride ?? part.holes ?? [],
    };
  }
  const holes = [...(part.holes ?? [])];
  const existing = holes[subpath];
  if (!existing) return part;
  holes[subpath] = { ...existing, points: migrateAnchors(points) };
  return { ...part, holes };
}

export type PathBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

export function pathBounds(points: PathAnchor[] | null | undefined): PathBounds {
  const pts = migrateAnchors(points ?? []);
  if (!pts.length) {
    return { minX: 0.5, maxX: 0.5, minY: 0.5, maxY: 0.5, cx: 0.5, cy: 0.5, width: 0, height: 0 };
  }
  let minX = pts[0]!.x;
  let maxX = pts[0]!.x;
  let minY = pts[0]!.y;
  let maxY = pts[0]!.y;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function mapAnchors(
  points: PathAnchor[],
  map: (x: number, y: number) => { x: number; y: number },
): PathAnchor[] {
  return migrateAnchors(points).map((p) => {
    const next = map(p.x, p.y);
    return {
      ...p,
      x: clamp01(next.x),
      y: clamp01(next.y),
      handleIn: mapNormPoint(p.handleIn, map),
      handleOut: mapNormPoint(p.handleOut, map),
    };
  });
}

/** Translate anchors in normalized plate space. */
export function translateAnchors(points: PathAnchor[], dx: number, dy: number): PathAnchor[] {
  return mapAnchors(points, (x, y) => ({ x: x + dx, y: y + dy }));
}

/** Scale anchors about a centre in normalized plate space. */
export function scaleAnchors(
  points: PathAnchor[],
  sx: number,
  sy: number,
  cx: number,
  cy: number,
): PathAnchor[] {
  const safeSx = Number.isFinite(sx) && Math.abs(sx) > 1e-6 ? sx : 1;
  const safeSy = Number.isFinite(sy) && Math.abs(sy) > 1e-6 ? sy : 1;
  return mapAnchors(points, (x, y) => ({
    x: cx + (x - cx) * safeSx,
    y: cy + (y - cy) * safeSy,
  }));
}

/** Rotate anchors about a centre (radians) in normalized plate space. */
export function rotateAnchors(
  points: PathAnchor[],
  angleRad: number,
  cx: number,
  cy: number,
): PathAnchor[] {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return mapAnchors(points, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  });
}

/**
 * Reserved: snap transformed geometry to nearby lens-opening edges.
 * Architecture hook only — currently a no-op.
 */
export type SnapToLensEdgeOptions = {
  enabled?: boolean;
  /** Lens opening polygons in the same normalized plate space. */
  lensOpenings?: LensPolygon[];
  /** Max snap distance in normalized units (future). */
  threshold?: number;
};

export function applySnapToLensEdge(
  points: PathAnchor[],
  options?: SnapToLensEdgeOptions,
): PathAnchor[] {
  if (!options?.enabled) return migrateAnchors(points);
  // Reserved for future edge snapping against options.lensOpenings.
  return migrateAnchors(points);
}

export function shapePresetLabel(preset: FramePartStartShape | null | undefined): string {
  if (preset === "rectangle") return "Rectangle";
  if (preset === "ellipse") return "Circle";
  if (preset === "free") return "Polygon";
  return "Shape";
}

/** True when live geometry differs from the transform-clean baseline (vertex edits). */
export function isShapeGeometryEdited(poly: LensPolygon | null | undefined): boolean {
  if (!poly?.shapeBaseline?.length) return false;
  const live = migrateAnchors(poly.points ?? []);
  const baseline = migrateAnchors(poly.shapeBaseline);
  if (live.length !== baseline.length) return true;
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!;
    const b = baseline[i]!;
    if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6) return true;
    if (Boolean(a.curved) !== Boolean(b.curved)) return true;
  }
  return false;
}

/**
 * Rebuild clean preset geometry from the current bounds (fallback when baseline is missing).
 * Prefer {@link resetPolygonToShapeBaseline} when a baseline exists (preserves rotation).
 */
export function rebuildPresetPoints(
  preset: Exclude<FramePartStartShape, "free">,
  fromPoints: PathAnchor[],
): PathAnchor[] {
  const b = pathBounds(fromPoints);
  const halfW = Math.max(0.005, b.width / 2);
  const halfH = Math.max(0.005, b.height / 2);
  return preset === "rectangle"
    ? rectanglePoints(b.cx, b.cy, halfW, halfH)
    : ellipsePoints(b.cx, b.cy, halfW, halfH);
}

/** Discard vertex edits and restore the transform-clean preset baseline. */
export function resetPolygonToShapeBaseline(poly: LensPolygon): LensPolygon {
  const preset = poly.shapePreset;
  if (preset === "free") return poly;
  if (preset !== "rectangle" && preset !== "ellipse") return poly;

  const baseline = migrateAnchors(poly.shapeBaseline ?? []);
  if (baseline.length >= 3) {
    return { ...poly, points: baseline };
  }
  const rebuilt = rebuildPresetPoints(preset, poly.points ?? []);
  return { ...poly, points: rebuilt, shapeBaseline: migrateAnchors(rebuilt) };
}

/** Reset the active outer or cutout subpath on a Manual Detail. */
export function resetSubpathToShapeBaseline(
  part: LensPolygon,
  subpath: FramePartSubpath,
): LensPolygon {
  if (subpath === "outer") {
    return resetPolygonToShapeBaseline(part);
  }
  const holes = [...(part.holes ?? [])];
  const hole = holes[subpath];
  if (!hole) return part;
  holes[subpath] = resetPolygonToShapeBaseline(hole);
  return { ...part, holes };
}
