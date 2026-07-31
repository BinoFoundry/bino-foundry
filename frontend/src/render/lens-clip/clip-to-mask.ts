import {
  resolveFrameExclusionShapes,
  type LensClipConfig,
  type LensClipShape,
  type LensExclusionShape,
} from "@bino-foundry/shared/types";
import {
  createLensPolygon,
  createMaskConfig,
  ensureFrameLensSet,
  migrateAnchors,
  normalizeAnchor,
  type LensPolygon,
  type MaskConfig,
  type PathAnchor,
} from "@/render/mask/mask-types";

type PathCommand = { op: "M" | "L" | "C" | "Z"; args: number[] };

type ShapePreset = "rectangle" | "ellipse" | "free";

function tokenizePathD(pathD: string): PathCommand[] {
  const trimmed = pathD.trim();
  if (!trimmed) return [];

  const chunks = trimmed.split(/(?=[MLCZ])/i).filter(Boolean);
  const commands: PathCommand[] = [];

  for (const chunk of chunks) {
    const op = chunk[0]?.toUpperCase();
    if (op !== "M" && op !== "L" && op !== "C" && op !== "Z") continue;
    const nums =
      op === "Z"
        ? []
        : chunk
            .slice(1)
            .trim()
            .split(/[\s,]+/)
            .filter(Boolean)
            .map((n) => Number.parseFloat(n))
            .filter((n) => Number.isFinite(n));

    commands.push({ op, args: nums });
  }

  return commands;
}

function pxToNorm(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: x / w, y: y / h };
}

function parseShapePreset(value: unknown): ShapePreset | undefined {
  return value === "rectangle" || value === "ellipse" || value === "free" ? value : undefined;
}

/** Parse SVG path `d` into normalized anchors (no polygon metadata). */
function pathDToAnchors(pathD: string, imageWidth: number, imageHeight: number): PathAnchor[] | null {
  const w = imageWidth;
  const h = imageHeight;
  if (!w || !h) return null;

  const commands = tokenizePathD(pathD);
  const points: PathAnchor[] = [];

  const pushPoint = (x: number, y: number, extras?: Partial<PathAnchor>) => {
    points.push(
      normalizeAnchor({
        x: x / w,
        y: y / h,
        curved: false,
        handleIn: null,
        handleOut: null,
        ...extras,
      }),
    );
  };

  for (const cmd of commands) {
    if (cmd.op === "M" && cmd.args.length >= 2) {
      pushPoint(cmd.args[0], cmd.args[1]);
    } else if (cmd.op === "L" && cmd.args.length >= 2) {
      pushPoint(cmd.args[0], cmd.args[1]);
    } else if (cmd.op === "C" && cmd.args.length >= 6) {
      const [c1x, c1y, c2x, c2y, x, y] = cmd.args;
      if (points.length > 0) {
        const prev = points[points.length - 1];
        prev.curved = true;
        prev.handleOut = pxToNorm(c1x, c1y, w, h);
      }
      pushPoint(x, y, { handleIn: pxToNorm(c2x, c2y, w, h) });
    }
  }

  if (points.length < 3) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const closed =
    Math.hypot(first.x - last.x, first.y - last.y) < 0.002 ||
    commands.some((c) => c.op === "Z");
  const finalPoints = closed && points.length > 1 ? points.slice(0, -1) : points;

  if (migrateAnchors(finalPoints).length < 3) return null;
  return finalPoints;
}

/** Reconstruct editor anchors from exported SVG path `d` (M/L/C/Z). */
export function pathDToLensPolygon(
  shape: Pick<
    LensClipShape | LensExclusionShape,
    | "id"
    | "label"
    | "pathD"
    | "layerOrder"
    | "opacity"
    | "depth"
    | "visible"
    | "notes"
    | "shapePreset"
    | "shapeBaselinePathD"
  >,
  imageWidth: number,
  imageHeight: number,
): LensPolygon | null {
  const finalPoints = pathDToAnchors(shape.pathD, imageWidth, imageHeight);
  if (!finalPoints) return null;

  const shapePreset = parseShapePreset(
    "shapePreset" in shape ? shape.shapePreset : undefined,
  );
  let shapeBaseline: PathAnchor[] | undefined;
  const baselinePathD =
    "shapeBaselinePathD" in shape && typeof shape.shapeBaselinePathD === "string"
      ? shape.shapeBaselinePathD
      : "";
  if (baselinePathD.trim()) {
    shapeBaseline = pathDToAnchors(baselinePathD, imageWidth, imageHeight) ?? undefined;
  }

  return createLensPolygon(shape.id, shape.label, finalPoints, {
    layerOrder: shape.layerOrder,
    opacity: shape.opacity,
    depth: shape.depth,
    visible: shape.visible,
    notes: shape.notes,
    shapePreset,
    shapeBaseline,
  });
}

/** Frame-level exclusions (merges canonical + legacy per-lens) → editor polygons. */
function frameExclusionsFromClip(clip: LensClipConfig): LensPolygon[] {
  const polygons: LensPolygon[] = [];
  for (const shape of resolveFrameExclusionShapes(clip)) {
    const polygon = pathDToLensPolygon(shape, clip.imageWidth, clip.imageHeight);
    if (!polygon) continue;
    const holes: LensPolygon[] = [];
    const holePathDs = shape.holePathDs ?? [];
    for (let i = 0; i < holePathDs.length; i++) {
      const holePreset = parseShapePreset(shape.holeShapePresets?.[i]);
      const holeBaselinePathD = shape.holeBaselinePathDs?.[i] ?? undefined;
      const hole = pathDToLensPolygon(
        {
          id: `${shape.id}-hole-${i + 1}`,
          label: `Hole ${i + 1}`,
          pathD: holePathDs[i]!,
          shapePreset: holePreset,
          shapeBaselinePathD: holeBaselinePathD ?? undefined,
        },
        clip.imageWidth,
        clip.imageHeight,
      );
      if (hole) holes.push(hole);
    }
    polygons.push({ ...polygon, holes });
  }
  return polygons;
}

/** Restore polygon editor state from saved LensClipConfig (when mask_config is absent). */
export function lensClipConfigToMaskConfig(clip: LensClipConfig): MaskConfig | null {
  const lenses: LensPolygon[] = [];

  for (const shape of clip.lenses) {
    const lens = pathDToLensPolygon(shape, clip.imageWidth, clip.imageHeight);
    if (lens) lenses.push(lens);
  }

  if (!lenses.length) return null;

  const frameExclusions = frameExclusionsFromClip(clip);
  return createMaskConfig(
    clip.imageWidth,
    clip.imageHeight,
    ensureFrameLensSet(lenses),
    undefined,
    frameExclusions.length ? frameExclusions : undefined,
  );
}
