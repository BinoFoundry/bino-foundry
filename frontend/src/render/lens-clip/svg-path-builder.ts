import { anchorPx, segmentControls } from "@/render/mask/bezier-path";
import { migrateAnchors, type LensPolygon, type PathAnchor } from "@/render/mask/mask-types";
import { smartCutoutExtraRings } from "@/render/mask/smart-cutout-detect";
import type { LensClipShape, LensExclusionShape } from "@bino-foundry/shared/types";

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, "") : "0";
}

/** Build closed SVG path `d` from polygon anchors (pixel coordinates). */
export function anchorsToPathD(
  points: PathAnchor[],
  imageWidth: number,
  imageHeight: number,
): string {
  const migrated = migrateAnchors(points);
  if (migrated.length < 3) return "";

  const w = imageWidth;
  const h = imageHeight;
  const p0 = anchorPx(migrated[0], w, h);
  const parts: string[] = [`M ${fmt(p0.x)} ${fmt(p0.y)}`];

  for (let i = 0; i < migrated.length; i++) {
    const a = migrated[i];
    const b = migrated[(i + 1) % migrated.length];
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

/** Build closed SVG path `d` from polygon editor lenses (pixel coordinates). */
export function lensPolygonToPathD(lens: LensPolygon, imageWidth: number, imageHeight: number): string {
  const primary = anchorsToPathD(lens.points ?? [], imageWidth, imageHeight);
  const extras = smartCutoutExtraRings(lens)
    .map((ring) => anchorsToPathD(ring, imageWidth, imageHeight))
    .filter(Boolean);
  if (!primary) return extras.join(" ");
  if (!extras.length) return primary;
  // Multiple islands as subpaths — evenodd fill keeps each island solid.
  return [primary, ...extras].join(" ");
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
      const holes = polygon.holes ?? [];
      const holeEntries = holes
        .map((hole) => ({
          hole,
          pathD: lensPolygonToPathD(hole, imageWidth, imageHeight),
        }))
        .filter((entry) => entry.pathD.trim().length > 0);
      const holePathDs = holeEntries.map((entry) => entry.pathD);
      const holeShapePresets = holeEntries.map((entry) =>
        entry.hole.shapePreset === "rectangle" ||
        entry.hole.shapePreset === "ellipse" ||
        entry.hole.shapePreset === "free"
          ? entry.hole.shapePreset
          : null,
      );
      const holeBaselinePathDs = holeEntries.map((entry) => {
        const baseline = entry.hole.shapeBaseline;
        if (!baseline?.length) return null;
        const d = lensPolygonToPathD(
          { id: entry.hole.id, label: entry.hole.label, points: baseline },
          imageWidth,
          imageHeight,
        );
        return d.trim() ? d : null;
      });
      const shapePreset =
        polygon.shapePreset === "rectangle" ||
        polygon.shapePreset === "ellipse" ||
        polygon.shapePreset === "free"
          ? polygon.shapePreset
          : undefined;
      const shapeBaselinePathD = polygon.shapeBaseline?.length
        ? lensPolygonToPathD(
            { id: polygon.id, label: polygon.label, points: polygon.shapeBaseline },
            imageWidth,
            imageHeight,
          )
        : "";
      return {
        id: polygon.id,
        label: polygon.label || "Frame part",
        pathD,
        ...(holePathDs.length ? { holePathDs } : {}),
        layerOrder: polygon.layerOrder ?? "behind",
        opacity: polygon.opacity ?? 100,
        depth: polygon.depth ?? 50,
        visible: polygon.visible !== false,
        notes: typeof polygon.notes === "string" ? polygon.notes : "",
        ...(shapePreset ? { shapePreset } : {}),
        ...(shapeBaselinePathD.trim() ? { shapeBaselinePathD } : {}),
        ...(holePathDs.length && holeShapePresets.some((p) => p)
          ? { holeShapePresets }
          : {}),
        ...(holePathDs.length && holeBaselinePathDs.some((d) => d)
          ? { holeBaselinePathDs }
          : {}),
      };
    })
    .filter((shape): shape is LensExclusionShape => Boolean(shape));
}
