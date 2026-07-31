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
  extras?: Partial<Pick<LensPolygon, "layerOrder" | "opacity" | "visible" | "depth" | "holes">>,
): LensPolygon {
  const id = newPartId("frame-part");
  const points =
    shape === "rectangle" ? rectanglePoints() : shape === "ellipse" ? ellipsePoints() : [];
  return createLensPolygon(id, label, points, {
    layerOrder: extras?.layerOrder ?? "front",
    opacity: extras?.opacity ?? 100,
    depth: extras?.depth ?? 50,
    visible: extras?.visible !== false,
    holes: extras?.holes ?? [],
  });
}

/** Copy a lens-opening polygon into a new Manual Detail (outer only — fully editable). */
export function createFramePartFromLensClip(
  lens: LensPolygon,
  label: string,
  extras?: Partial<Pick<LensPolygon, "layerOrder" | "opacity" | "visible" | "depth">>,
): LensPolygon {
  return createLensPolygon(newPartId("frame-part"), label, migrateAnchors(lens.points ?? []), {
    layerOrder: extras?.layerOrder ?? "front",
    opacity: extras?.opacity ?? 100,
    depth: extras?.depth ?? 50,
    visible: extras?.visible !== false,
    holes: [],
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
  return createLensPolygon(newPartId("cutout"), label, points);
}

/** Duplicate an existing cutout with a slight offset so it is visible as a new shape. */
export function duplicateCutout(hole: LensPolygon, label?: string): LensPolygon {
  const points = translateAnchors(migrateAnchors(hole.points ?? []), 0.02, 0.02);
  return createLensPolygon(newPartId("cutout"), label ?? hole.label ?? "Cutout", points);
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
  return pathDToLensPolygon(
    { id: newPartId("cutout"), label, pathD: insetD },
    imageWidth,
    imageHeight,
  );
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
