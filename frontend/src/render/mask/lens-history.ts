import { migrateAnchors, type LensPolygon } from "./mask-types";

export const MAX_EDITOR_HISTORY = 80;

export type EditorHistorySnapshot = {
  lenses: LensPolygon[];
  activeLensIndex: number;
  selectedPointIndex: number;
};

/** Deep-clone lens paths for undo/redo stacks. */
export function cloneLenses(lenses: LensPolygon[]): LensPolygon[] {
  return lenses.map((l) => ({
    id: l.id,
    label: l.label,
    points: migrateAnchors(l.points).map((p) => ({
      x: p.x,
      y: p.y,
      curved: Boolean(p.curved),
      handleIn: p.handleIn ? { x: p.handleIn.x, y: p.handleIn.y } : null,
      handleOut: p.handleOut ? { x: p.handleOut.x, y: p.handleOut.y } : null,
    })),
  }));
}

export function captureEditorState(editor: {
  lenses: LensPolygon[];
  activeLensIndex: number;
  selectedPointIndex: number;
}): EditorHistorySnapshot {
  return {
    lenses: cloneLenses(editor.lenses),
    activeLensIndex: editor.activeLensIndex,
    selectedPointIndex: editor.selectedPointIndex,
  };
}

export function applyEditorState(
  editor: {
    lenses: LensPolygon[];
    activeLensIndex: number;
    selectedPointIndex: number;
  },
  snap: EditorHistorySnapshot,
) {
  editor.lenses = cloneLenses(snap.lenses);
  editor.activeLensIndex = snap.activeLensIndex;
  editor.selectedPointIndex = snap.selectedPointIndex;
}
