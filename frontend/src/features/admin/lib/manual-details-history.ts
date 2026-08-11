import { migrateAnchors, type LensPolygon, type PathAnchor } from "@/render/mask/mask-types";
import type { FramePartSubpath } from "@/features/admin/lib/frame-parts";

export const MAX_MANUAL_DETAILS_HISTORY = 80;

/** Coalesce rapid commits (vertex drag, opacity scrub) into one undo step. */
export const HISTORY_COALESCE_MS = 400;

export type ManualDetailsSnapshot = {
  parts: LensPolygon[];
  activePartIndex: number;
  activeSubpath: FramePartSubpath;
};

function cloneAnchor(p: PathAnchor): PathAnchor {
  return {
    x: p.x,
    y: p.y,
    curved: Boolean(p.curved),
    handleIn: p.handleIn ? { x: p.handleIn.x, y: p.handleIn.y } : null,
    handleOut: p.handleOut ? { x: p.handleOut.x, y: p.handleOut.y } : null,
  };
}

function cloneAnchors(points: PathAnchor[] | null | undefined): PathAnchor[] {
  return migrateAnchors(points ?? []).map(cloneAnchor);
}

/** Deep-clone Manual Detail polygons (holes + shape presets) for undo/redo.
 * Snapshots intentionally omit UI/navigation state (Transform vs Edit Shape tab).
 */
export function cloneManualDetailParts(parts: LensPolygon[]): LensPolygon[] {
  return parts.map((part) => ({
    id: part.id,
    label: part.label,
    points: cloneAnchors(part.points),
    layerOrder: part.layerOrder,
    opacity: part.opacity,
    depth: part.depth,
    visible: part.visible,
    notes: part.notes,
    shapePreset: part.shapePreset,
    shapeBaseline: part.shapeBaseline?.length ? cloneAnchors(part.shapeBaseline) : undefined,
    holes: (part.holes ?? []).map((hole) => ({
      id: hole.id,
      label: hole.label,
      points: cloneAnchors(hole.points),
      shapePreset: hole.shapePreset,
      shapeBaseline: hole.shapeBaseline?.length ? cloneAnchors(hole.shapeBaseline) : undefined,
    })),
  }));
}

export function captureManualDetailsSnapshot(
  parts: LensPolygon[],
  activePartIndex: number,
  activeSubpath: FramePartSubpath,
): ManualDetailsSnapshot {
  return {
    parts: cloneManualDetailParts(parts),
    activePartIndex,
    activeSubpath,
  };
}

const COORD_EPS = 1e-6;

function approxEq(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= COORD_EPS;
}

function anchorsEqual(a: PathAnchor[] | null | undefined, b: PathAnchor[] | null | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const p = left[i]!;
    const q = right[i]!;
    if (!approxEq(p.x, q.x) || !approxEq(p.y, q.y)) return false;
    if (Boolean(p.curved) !== Boolean(q.curved)) return false;
    if (!approxEq(p.handleIn?.x, q.handleIn?.x) || !approxEq(p.handleIn?.y, q.handleIn?.y)) return false;
    if (!approxEq(p.handleOut?.x, q.handleOut?.x) || !approxEq(p.handleOut?.y, q.handleOut?.y)) {
      return false;
    }
  }
  return true;
}

function holeEqual(
  a: NonNullable<LensPolygon["holes"]>[number],
  b: NonNullable<LensPolygon["holes"]>[number],
): boolean {
  return (
    a.id === b.id &&
    (a.label ?? "") === (b.label ?? "") &&
    a.shapePreset === b.shapePreset &&
    anchorsEqual(a.points, b.points) &&
    anchorsEqual(a.shapeBaseline, b.shapeBaseline)
  );
}

/** True when Manual Detail geometry/meta match (ignores object identity). */
export function manualDetailsPartsEqual(a: LensPolygon[], b: LensPolygon[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.id !== right.id) return false;
    if ((left.label ?? "") !== (right.label ?? "")) return false;
    if (left.opacity !== right.opacity) return false;
    if (left.depth !== right.depth) return false;
    if (Boolean(left.visible) !== Boolean(right.visible)) return false;
    if ((left.notes ?? "") !== (right.notes ?? "")) return false;
    if (left.shapePreset !== right.shapePreset) return false;
    if (left.layerOrder !== right.layerOrder) return false;
    if (!anchorsEqual(left.points, right.points)) return false;
    if (!anchorsEqual(left.shapeBaseline, right.shapeBaseline)) return false;
    const leftHoles = left.holes ?? [];
    const rightHoles = right.holes ?? [];
    if (leftHoles.length !== rightHoles.length) return false;
    for (let h = 0; h < leftHoles.length; h++) {
      if (!holeEqual(leftHoles[h]!, rightHoles[h]!)) return false;
    }
  }
  return true;
}

export function isTypingInFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}
