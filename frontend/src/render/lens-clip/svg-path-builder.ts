import { anchorPx, segmentControls } from "@/render/mask/bezier-path";
import { migrateAnchors, type LensPolygon } from "@/render/mask/mask-types";
import type { LensClipShape, LensExclusionShape } from "@bino-foundry/shared/types";

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, "") : "0";
}

/** Build closed SVG path `d` from polygon editor lenses (pixel coordinates). */
export function lensPolygonToPathD(lens: LensPolygon, imageWidth: number, imageHeight: number): string {
  const points = migrateAnchors(lens.points);
  if (points.length < 3) return "";

  const w = imageWidth;
  const h = imageHeight;
  const p0 = anchorPx(points[0], w, h);
  const parts: string[] = [`M ${fmt(p0.x)} ${fmt(p0.y)}`];

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const seg = segmentControls(a, b, w, h);
    if (seg.straight) {
      parts.push(`L ${fmt(seg.p3.x)} ${fmt(seg.p3.y)}`);
    } else {
      parts.push(
        `C ${fmt(seg.p1.x)} ${fmt(seg.p1.y)} ${fmt(seg.p2.x)} ${fmt(seg.p2.y)} ${fmt(seg.p3.x)} ${fmt(seg.p3.y)}`,
      );
    }
  }
  parts.push("Z");
  return parts.join(" ");
}

export function lensesToClipShapes(
  lenses: LensPolygon[],
  imageWidth: number,
  imageHeight: number,
): LensClipShape[] {
  // Exclusions are frame-level (see LensClipConfig.frameExclusions); lenses hold only the
  // opening path. Frame parts are restored by an overlay at render time.
  return lenses
    .map((lens) => ({
      id: lens.id,
      label: lens.label,
      pathD: lensPolygonToPathD(lens, imageWidth, imageHeight),
    }))
    .filter((l) => l.pathD.length > 0);
}

export function exclusionPolygonsToShapes(
  polygons: LensPolygon[],
  imageWidth: number,
  imageHeight: number,
): LensExclusionShape[] {
  return polygons
    .map((polygon) => {
      const pathD = lensPolygonToPathD(polygon, imageWidth, imageHeight);
      if (!pathD.trim()) return null;
      return {
        id: polygon.id,
        label: polygon.label || "Frame object",
        pathD,
        layerOrder: polygon.layerOrder ?? "behind",
        opacity: polygon.opacity ?? 100,
        depth: polygon.depth ?? 50,
        visible: polygon.visible !== false,
      };
    })
    .filter((shape): shape is LensExclusionShape => Boolean(shape));
}
