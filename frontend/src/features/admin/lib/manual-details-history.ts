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

/** Deep-clone Manual Detail polygons (holes + shape presets) for undo/redo. */
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

export function isTypingInFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}
