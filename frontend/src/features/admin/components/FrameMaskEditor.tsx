import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Redo2, Trash2, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import type { PolygonEditorShellHandle } from "@/render/editor/PolygonEditorShell";
import { EditorTool } from "@/render/mask/editor-interaction";
import {
  createLensPolygon,
  createMaskConfig,
  defaultLensSet,
  ensureFrameLensSet,
  isMaskConfigValid,
  resolveMaskFrameExclusions,
  type FrameLensSide,
  LENS_SIDE_LABELS,
  type LensPolygon,
  type MaskConfig,
  type PathAnchor,
} from "@/render/mask";
import {
  createFramePart,
  createFramePartFromLensClip,
  createCutoutFromPreset,
  createInsetCutoutFromOuter,
  createScaledCutout,
  duplicateCutout,
  isShapeGeometryEdited,
  resetSubpathToShapeBaseline,
  shapePresetLabel,
  type FramePartStartShape,
  type FramePartSubpath,
} from "@/features/admin/lib/frame-parts";
import {
  HISTORY_COALESCE_MS,
  MAX_MANUAL_DETAILS_HISTORY,
  captureManualDetailsSnapshot,
  isTypingInFormField,
  manualDetailsPartsEqual,
  type ManualDetailsSnapshot,
} from "@/features/admin/lib/manual-details-history";
import { FramePartTransformCanvas } from "@/features/admin/components/FramePartTransformCanvas";
import { CutoutDetectSettingsFields } from "@/features/admin/components/CutoutDetectSettingsFields";
import {
  SmartCutoutCanvas,
  type SmartCutoutCanvasHandle,
} from "@/features/admin/components/SmartCutoutCanvas";
import {
  applySmartResultToPolygon,
  clampCutoutDetectSettings,
  createSmartCutoutFramePart,
  createSmartCutoutHoles,
  DEFAULT_CUTOUT_DETECT_SETTINGS,
  getCutoutDetectSettings,
  patchCutoutDetectSettings,
  type CutoutDetectSettings,
  type SmartCutoutResult,
} from "@/render/mask/smart-cutout-detect";

/** Internal mode id kept for persistence wiring; UI copy says Manual Details. */
export type LensEditorMode = "polygon" | "exclusions";

type PartEditPhase = "transform" | "vertex" | "smart";
type SmartCutoutApplyMode = "detail" | "hole";

interface FrameMaskEditorProps {
  plateUrl: string;
  width: number;
  height: number;
  initialMask?: MaskConfig | null;
  /** Bump when initialMask paths change externally (auto-detect). */
  lensRevision?: number;
  /** When set, editor focuses on one lens path only (left or right). Polygon mode only. */
  focusedLensId?: FrameLensSide;
  /** Lens polygon editing vs manual details (rivets, screws, logos above glass). */
  editMode?: LensEditorMode;
  onChange?: (config: MaskConfig | null) => void;
  className?: string;
}

function getFrameParts(mask: MaskConfig | null | undefined): LensPolygon[] {
  return resolveMaskFrameExclusions(mask);
}

/** List index → depth so compositor order matches the admin list; force Above Glass. */
function withListOrderDepth(list: LensPolygon[]): LensPolygon[] {
  return list.map((part, index) => ({
    ...part,
    depth: index,
    holes: Array.isArray(part.holes) ? part.holes : [],
    layerOrder: "front" as const,
  }));
}

const START_SHAPES: { value: FramePartStartShape; label: string; hint: string }[] = [
  { value: "rectangle", label: "Rectangle", hint: "Quick box — transform, then Edit Shape to refine." },
  { value: "ellipse", label: "Circle", hint: "Rounded starting shape — Edit Shape to add points." },
  { value: "free", label: "Polygon", hint: "Empty path — draw vertices yourself." },
];

/** Lens clip path editor (polygon/curve tools → persisted as SVG clip paths). */
export function FrameMaskEditor({
  plateUrl,
  width,
  height,
  initialMask,
  lensRevision = 0,
  focusedLensId,
  editMode = "polygon",
  onChange,
  className,
}: FrameMaskEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialMaskRef = useRef(initialMask);
  initialMaskRef.current = initialMask;
  const focusedLensIdRef = useRef(focusedLensId);
  focusedLensIdRef.current = focusedLensId;
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  const [activePartIndex, setActivePartIndex] = useState(0);
  const [activeSubpath, setActiveSubpath] = useState<FramePartSubpath>("outer");
  const [partRevision, setPartRevision] = useState(0);
  const [editPhase, setEditPhase] = useState<PartEditPhase>("transform");
  const [smartApplyMode, setSmartApplyMode] = useState<SmartCutoutApplyMode>("detail");
  const [smartEditTarget, setSmartEditTarget] = useState<"new" | "active">("new");
  /** Draft settings for a not-yet-applied new cutout — never shared with existing cutouts. */
  const [draftDetectSettings, setDraftDetectSettings] = useState<CutoutDetectSettings>(() => ({
    ...DEFAULT_CUTOUT_DETECT_SETTINGS,
  }));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [insetPx, setInsetPx] = useState(2);
  const [showInsetForm, setShowInsetForm] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [smartCanUndo, setSmartCanUndo] = useState(false);
  const [smartCanRedo, setSmartCanRedo] = useState(false);

  const [partList, setPartListState] = useState<LensPolygon[]>(() =>
    getFrameParts(initialMaskRef.current),
  );
  const partListRef = useRef(partList);
  const setPartList = useCallback((next: LensPolygon[]) => {
    partListRef.current = next;
    setPartListState(next);
  }, []);

  const activePartIndexRef = useRef(activePartIndex);
  activePartIndexRef.current = activePartIndex;
  const activeSubpathRef = useRef(activeSubpath);
  activeSubpathRef.current = activeSubpath;
  const editPhaseRef = useRef(editPhase);
  editPhaseRef.current = editPhase;

  const historyPastRef = useRef<ManualDetailsSnapshot[]>([]);
  const historyFutureRef = useRef<ManualDetailsSnapshot[]>([]);
  const historyCoalesceRef = useRef(false);
  const historyCoalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingHistoryRef = useRef(false);
  /** Swallow PolygonEditorShell hydrate emits after undo/redo remount (clears redo otherwise). */
  const historyHydrateSuppressRef = useRef(0);
  const vertexEditorHandleRef = useRef<PolygonEditorShellHandle | null>(null);
  const smartHistoryHandleRef = useRef<SmartCutoutCanvasHandle | null>(null);

  const syncHistoryButtons = useCallback(() => {
    const smartUndo =
      editPhaseRef.current === "smart" &&
      (smartCanUndo || (smartHistoryHandleRef.current?.canUndo() ?? false));
    const smartRedo =
      editPhaseRef.current === "smart" &&
      (smartCanRedo || (smartHistoryHandleRef.current?.canRedo() ?? false));
    setCanUndo(historyPastRef.current.length > 0 || smartUndo);
    setCanRedo(historyFutureRef.current.length > 0 || smartRedo);
  }, [smartCanRedo, smartCanUndo]);

  const handleSmartHistoryChange = useCallback(
    (state: { canUndo: boolean; canRedo: boolean }) => {
      setSmartCanUndo(state.canUndo);
      setSmartCanRedo(state.canRedo);
      setCanUndo(historyPastRef.current.length > 0 || state.canUndo);
      setCanRedo(historyFutureRef.current.length > 0 || state.canRedo);
    },
    [],
  );

  const captureNow = useCallback(
    (): ManualDetailsSnapshot =>
      captureManualDetailsSnapshot(
        partListRef.current,
        activePartIndexRef.current,
        activeSubpathRef.current,
      ),
    [],
  );

  const recordHistory = useCallback(() => {
    if (applyingHistoryRef.current) return;
    historyPastRef.current.push(captureNow());
    if (historyPastRef.current.length > MAX_MANUAL_DETAILS_HISTORY) {
      historyPastRef.current.shift();
    }
    historyFutureRef.current = [];
    syncHistoryButtons();
  }, [captureNow, syncHistoryButtons]);

  const endHistoryCoalesce = useCallback(() => {
    historyCoalesceRef.current = false;
    if (historyCoalesceTimerRef.current) {
      clearTimeout(historyCoalesceTimerRef.current);
      historyCoalesceTimerRef.current = null;
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const emitParts = useCallback((list: LensPolygon[]) => {
    const ordered = withListOrderDepth(list);
    const mask = initialMaskRef.current;
    const baseLenses = ensureFrameLensSet(mask?.lenses ?? defaultLensSet());
    const config = createMaskConfig(
      mask?.imageWidth || width,
      mask?.imageHeight || height,
      baseLenses,
      undefined,
      ordered.filter((part) => (part.points?.length ?? 0) >= 1),
    );
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  }, [height, width]);

  const commitList = useCallback(
    (
      list: LensPolygon[],
      options?: {
        selectIndex?: number;
        bumpRevision?: boolean;
        /** Skip pushing history (undo/redo apply). */
        skipHistory?: boolean;
        /** Coalesce rapid updates (vertex drag, opacity) into one undo step. */
        coalesce?: boolean;
      },
    ) => {
      const ordered = withListOrderDepth(list);
      // No-op hydrates (and identical re-commits) must not push history or clear redo.
      const partsUnchanged = manualDetailsPartsEqual(ordered, partListRef.current);
      const skipHistory =
        Boolean(options?.skipHistory) || applyingHistoryRef.current || partsUnchanged;

      if (!skipHistory) {
        if (options?.coalesce) {
          if (!historyCoalesceRef.current) {
            recordHistory();
            historyCoalesceRef.current = true;
          }
          if (historyCoalesceTimerRef.current) clearTimeout(historyCoalesceTimerRef.current);
          historyCoalesceTimerRef.current = setTimeout(() => {
            historyCoalesceRef.current = false;
            historyCoalesceTimerRef.current = null;
          }, HISTORY_COALESCE_MS);
        } else {
          endHistoryCoalesce();
          recordHistory();
        }
      }

      setPartList(ordered);
      if (options?.selectIndex != null) {
        setActivePartIndex(options.selectIndex);
      }
      if (options?.bumpRevision) {
        setPartRevision((r) => r + 1);
      }
      emitParts(ordered);
    },
    [emitParts, endHistoryCoalesce, recordHistory, setPartList],
  );

  const applyHistorySnapshot = useCallback(
    (snap: ManualDetailsSnapshot) => {
      applyingHistoryRef.current = true;
      // Vertex editor remount emits hydrate changes after partRevision bump; swallow those only.
      if (editPhaseRef.current === "vertex") {
        historyHydrateSuppressRef.current = Math.max(historyHydrateSuppressRef.current, 2);
      }
      endHistoryCoalesce();
      try {
        const ordered = withListOrderDepth(snap.parts);
        setPartList(ordered);
        setActivePartIndex(
          Math.max(0, Math.min(snap.activePartIndex, Math.max(0, ordered.length - 1))),
        );
        setActiveSubpath(snap.activeSubpath);
        // Keep the user's current Transform / Edit Shape tab — history stores geometry only.
        setPartRevision((r) => r + 1);
        emitParts(ordered);
      } finally {
        // Keep mute until after this turn — remount hydrate is async (image + rAF).
        queueMicrotask(() => {
          applyingHistoryRef.current = false;
        });
        syncHistoryButtons();
      }
    },
    [emitParts, endHistoryCoalesce, setPartList, syncHistoryButtons],
  );

  const undoManualDetails = useCallback(() => {
    // Prefer Smart Detect session steps while that tool is open (detection vanish / reappear).
    if (editPhaseRef.current === "smart" && smartHistoryHandleRef.current?.canUndo()) {
      smartHistoryHandleRef.current.undo();
      return;
    }
    if (!historyPastRef.current.length) return;
    const current = captureNow();
    const prev = historyPastRef.current.pop()!;
    historyFutureRef.current.push(current);
    applyHistorySnapshot(prev);
  }, [applyHistorySnapshot, captureNow]);

  const redoManualDetails = useCallback(() => {
    if (editPhaseRef.current === "smart" && smartHistoryHandleRef.current?.canRedo()) {
      smartHistoryHandleRef.current.redo();
      return;
    }
    if (!historyFutureRef.current.length) return;
    const current = captureNow();
    const next = historyFutureRef.current.pop()!;
    historyPastRef.current.push(current);
    applyHistorySnapshot(next);
  }, [applyHistorySnapshot, captureNow]);

  const patchActive = useCallback(
    (partial: Partial<LensPolygon>) => {
      if (!partListRef.current.length) return;
      const next = partListRef.current.map((part, i) =>
        i === activePartIndex
          ? {
              ...part,
              ...partial,
              holes: partial.holes !== undefined ? partial.holes : part.holes ?? [],
            }
          : part,
      );
      commitList(next, { coalesce: true });
    },
    [activePartIndex, commitList],
  );

  const mergeFocusedEdit = useCallback((edited: LensPolygon[], imgW: number, imgH: number): MaskConfig => {
    const focus = focusedLensIdRef.current;
    const editedLens = edited[0];
    const frameParts = getFrameParts(initialMaskRef.current);
    if (!focus || !editedLens) {
      return createMaskConfig(imgW, imgH, edited, undefined, frameParts);
    }

    const base = ensureFrameLensSet(initialMaskRef.current?.lenses ?? defaultLensSet());
    const merged = base.map((lens) =>
      lens.id === focus
        ? { ...lens, points: editedLens.points, label: LENS_SIDE_LABELS[focus] }
        : lens,
    );
    return createMaskConfig(imgW, imgH, merged, undefined, frameParts);
  }, []);

  const handleLensesChange = useCallback(
    (lenses: LensPolygon[], meta: { imgW: number; imgH: number }) => {
      if (editModeRef.current === "exclusions") {
        // Vertex mode edits Outer + Cutouts as parallel paths in PolygonEditorShell.
        const next = [...partListRef.current];
        const idx = Math.min(activePartIndex, Math.max(0, next.length - 1));
        const current = next[idx];
        if (!current || lenses.length === 0) {
          commitList(next, { skipHistory: true });
          return;
        }
        const [outer, ...holePaths] = lenses;
        next[idx] = {
          ...current,
          id: current.id,
          label: current.label,
          points: outer?.points ?? current.points,
          shapePreset: current.shapePreset,
          shapeBaseline: current.shapeBaseline,
          holes: holePaths.map((hole, hi) => {
            const prev = current.holes?.[hi];
            return {
              id: prev?.id ?? hole.id ?? `cutout-${hi}`,
              label: prev?.label ?? hole.label ?? `Cutout ${hi + 1}`,
              points: hole.points ?? [],
              shapePreset: prev?.shapePreset,
              shapeBaseline: prev?.shapeBaseline,
            };
          }),
        };
        let skipHistory = false;
        if (historyHydrateSuppressRef.current > 0) {
          historyHydrateSuppressRef.current -= 1;
          skipHistory = true;
        }
        commitList(next, { coalesce: true, skipHistory });
        return;
      }

      const config = focusedLensIdRef.current
        ? mergeFocusedEdit(lenses, meta.imgW, meta.imgH)
        : createMaskConfig(
            meta.imgW,
            meta.imgH,
            lenses,
            undefined,
            getFrameParts(initialMaskRef.current),
          );

      onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
    },
    [activePartIndex, commitList, mergeFocusedEdit],
  );

  const focusedLabel = focusedLensId ? LENS_SIDE_LABELS[focusedLensId] : undefined;
  const activePart =
    partList[activePartIndex] ??
    createLensPolygon(`frame-part-fallback`, `Part ${activePartIndex + 1}`, [], {
      layerOrder: "front",
      holes: [],
    });
  const activeHoles = activePart.holes ?? [];
  const activePathPolygon =
    activeSubpath === "outer"
      ? activePart
      : activeHoles[typeof activeSubpath === "number" ? activeSubpath : -1] ?? null;

  /** Settings for the selected path — or an isolated draft when creating a new cutout. */
  const activeDetectSettings: CutoutDetectSettings =
    smartEditTarget === "new" && editPhase === "smart"
      ? draftDetectSettings
      : getCutoutDetectSettings(activePathPolygon);

  const patchActiveDetectSettings = useCallback(
    (next: CutoutDetectSettings) => {
      const clamped = clampCutoutDetectSettings(next);
      // New-cutout draft: keep settings local until Apply.
      if (smartEditTarget === "new" && editPhaseRef.current === "smart") {
        setDraftDetectSettings(clamped);
        return;
      }
      const part = partListRef.current[activePartIndexRef.current];
      if (!part) return;
      const sub = activeSubpathRef.current;
      if (sub === "outer") {
        const updated = patchCutoutDetectSettings(part, clamped);
        const list = partListRef.current.map((item, i) =>
          i === activePartIndexRef.current ? updated : item,
        );
        commitList(list, { coalesce: true });
        return;
      }
      const hole = part.holes?.[sub];
      if (!hole) return;
      const updatedHole = patchCutoutDetectSettings(hole, clamped);
      const holes = (part.holes ?? []).map((h, i) => (i === sub ? updatedHole : h));
      const list = partListRef.current.map((item, i) =>
        i === activePartIndexRef.current ? { ...item, holes } : item,
      );
      commitList(list, { coalesce: true });
    },
    [commitList, smartEditTarget],
  );

  const beginNewSmartDraft = useCallback(() => {
    setDraftDetectSettings({ ...DEFAULT_CUTOUT_DETECT_SETTINGS });
    setSmartEditTarget("new");
  }, []);

  /** Immediately add an empty Manual Detail and open Smart Detect on it. */
  const startNewSmartManualDetail = useCallback(() => {
    const n =
      partListRef.current.filter((p) =>
        (p.label || "").toLowerCase().includes("smart cutout"),
      ).length + 1;
    const part = createFramePart(`Smart Cutout ${n}`, "free", {
      depth: partListRef.current.length,
      layerOrder: "front",
    });
    const next = [...partListRef.current, part];
    setShowAddMenu(false);
    setSmartApplyMode("detail");
    setSmartEditTarget("active");
    setActiveSubpath("outer");
    setEditPhase("smart");
    setDraftDetectSettings({ ...DEFAULT_CUTOUT_DETECT_SETTINGS });
    commitList(next, { selectIndex: next.length - 1, bumpRevision: true });
  }, [commitList]);

  const selectPart = (index: number, subpath: FramePartSubpath = "outer") => {
    setActivePartIndex(index);
    setActiveSubpath(subpath);
    setEditPhase("transform");
    setPartRevision((r) => r + 1);
  };

  const addPart = (shape: FramePartStartShape) => {
    const next = [
      ...partListRef.current,
      createFramePart(`Part ${partListRef.current.length + 1}`, shape, {
        depth: partListRef.current.length,
      }),
    ];
    setShowAddMenu(false);
    setActiveSubpath("outer");
    setEditPhase(shape === "free" ? "vertex" : "transform");
    commitList(next, { selectIndex: next.length - 1, bumpRevision: true });
  };

  const addPartFromLens = (lensId: FrameLensSide) => {
    const lenses = ensureFrameLensSet(initialMaskRef.current?.lenses ?? defaultLensSet());
    const lens = lenses.find((l) => l.id === lensId);
    if (!lens || (lens.points?.length ?? 0) < 3) {
      setShowAddMenu(false);
      return;
    }
    const label =
      lensId === "left" ? "Inner lip L" : lensId === "right" ? "Inner lip R" : `From ${lens.label}`;
    const next = [
      ...partListRef.current,
      createFramePartFromLensClip(lens, label, { depth: partListRef.current.length }),
    ];
    setShowAddMenu(false);
    setActiveSubpath("outer");
    setEditPhase("transform");
    commitList(next, { selectIndex: next.length - 1, bumpRevision: true });
  };

  const removeActivePart = useCallback(() => {
    if (!partListRef.current.length) return;
    const next = partListRef.current.filter((_, i) => i !== activePartIndexRef.current);
    const nextIndex = next.length === 0 ? 0 : Math.min(activePartIndexRef.current, next.length - 1);
    setEditPhase("transform");
    setActiveSubpath("outer");
    commitList(next, { selectIndex: nextIndex, bumpRevision: true });
  }, [commitList]);

  const deleteActiveCutout = useCallback(() => {
    if (activeSubpathRef.current === "outer") return;
    const part = partListRef.current[activePartIndexRef.current];
    if (!part) return;
    const holes = (part.holes ?? []).filter((_, i) => i !== activeSubpathRef.current);
    const next = partListRef.current.map((item, i) =>
      i === activePartIndexRef.current ? { ...item, holes } : item,
    );
    setActiveSubpath("outer");
    commitList(next, { bumpRevision: true });
  }, [commitList]);

  /** Shared by Delete button and keyboard Delete / Backspace. */
  const deleteSelectedElement = useCallback(() => {
    if (editPhaseRef.current === "vertex") {
      const api = vertexEditorHandleRef.current;
      if (api?.hasSelectedPoint()) {
        api.removeSelectedPoint();
        return;
      }
    }
    if (activeSubpathRef.current !== "outer") {
      deleteActiveCutout();
      return;
    }
    removeActivePart();
  }, [deleteActiveCutout, removeActivePart]);

  useEffect(() => {
    if (editPhase !== "vertex") {
      historyHydrateSuppressRef.current = 0;
    }
    if (editPhase !== "smart") {
      setSmartCanUndo(false);
      setSmartCanRedo(false);
    }
    syncHistoryButtons();
  }, [editPhase, syncHistoryButtons]);

  useEffect(() => {
    if (editMode !== "exclusions") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInFormField(e.target)) return;

      if (e.key === "Escape" && (editPhaseRef.current === "vertex" || editPhaseRef.current === "smart")) {
        e.preventDefault();
        setEditPhase("transform");
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redoManualDetails();
        else undoManualDetails();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redoManualDetails();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!partListRef.current.length) return;
        e.preventDefault();
        deleteSelectedElement();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (historyCoalesceTimerRef.current) {
        clearTimeout(historyCoalesceTimerRef.current);
        historyCoalesceTimerRef.current = null;
      }
    };
  }, [deleteSelectedElement, editMode, redoManualDetails, undoManualDetails]);

  const commitTransformedGeometry = (
    index: number,
    geometry: {
      points: PathAnchor[];
      holes: LensPolygon[];
      shapeBaseline?: PathAnchor[];
    },
  ) => {
    const next = partListRef.current.map((part, i) =>
      i === index
        ? {
            ...part,
            points: geometry.points,
            holes: geometry.holes,
            shapeBaseline:
              geometry.shapeBaseline !== undefined
                ? geometry.shapeBaseline
                : part.shapeBaseline,
          }
        : part,
    );
    commitList(next);
  };

  const addCutout = (shape: FramePartStartShape = "free") => {
    const part = partListRef.current[activePartIndex];
    if (!part) return;
    const label = `Cutout ${(part.holes?.length ?? 0) + 1}`;
    const hole =
      shape === "rectangle" || shape === "ellipse"
        ? createCutoutFromPreset(part.points ?? [], shape, label)
        : createScaledCutout(part.points ?? [], label);
    const holes = [...(part.holes ?? []), hole];
    const next = partListRef.current.map((item, i) =>
      i === activePartIndex ? { ...item, holes } : item,
    );
    setActiveSubpath(holes.length - 1);
    setEditPhase("transform");
    commitList(next, { bumpRevision: true });
  };

  const resetActiveShape = () => {
    const part = partListRef.current[activePartIndex];
    if (!part) return;
    const target =
      activeSubpath === "outer" ? part : part.holes?.[activeSubpath];
    if (!target?.shapePreset || target.shapePreset === "free") return;
    if (!isShapeGeometryEdited(target) && (target.shapeBaseline?.length ?? 0) > 0) return;
    const nextPart = resetSubpathToShapeBaseline(part, activeSubpath);
    const next = partListRef.current.map((item, i) =>
      i === activePartIndex ? nextPart : item,
    );
    commitList(next, { bumpRevision: true });
  };

  const addInsetCutout = () => {
    const part = partListRef.current[activePartIndex];
    const mask = initialMaskRef.current;
    if (!part || !mask) return;
    const label = `Cutout ${(part.holes?.length ?? 0) + 1}`;
    const hole = createInsetCutoutFromOuter(
      part.points ?? [],
      mask.imageWidth || width,
      mask.imageHeight || height,
      insetPx,
      label,
    );
    if (!hole) return;
    const holes = [...(part.holes ?? []), hole];
    const next = partListRef.current.map((item, i) =>
      i === activePartIndex ? { ...item, holes } : item,
    );
    setActiveSubpath(holes.length - 1);
    setShowInsetForm(false);
    commitList(next, { bumpRevision: true });
  };

  const duplicateActiveCutout = () => {
    if (activeSubpath === "outer") return;
    const part = partListRef.current[activePartIndex];
    const source = part?.holes?.[activeSubpath];
    if (!part || !source) return;
    const copy = duplicateCutout(source, `${source.label || "Cutout"} copy`);
    const holes = [...(part.holes ?? []), copy];
    const next = partListRef.current.map((item, i) =>
      i === activePartIndex ? { ...item, holes } : item,
    );
    setActiveSubpath(holes.length - 1);
    commitList(next, { bumpRevision: true });
  };

  const applySmartCutout = useCallback(
    (result: SmartCutoutResult) => {
      const extraIslands = result.regions ?? [];

      // Update the currently selected outer/hole when editing an existing cutout.
      if (smartEditTarget === "active" && partListRef.current.length) {
        const part = partListRef.current[activePartIndexRef.current];
        const sub = activeSubpathRef.current;
        if (part) {
          if (sub === "outer") {
            const updated = applySmartResultToPolygon(part, result);
            const next = partListRef.current.map((item, i) =>
              i === activePartIndexRef.current ? updated : item,
            );
            setSmartEditTarget("active");
            setEditPhase("transform");
            commitList(next, { bumpRevision: true });
            return;
          }
          const hole = part.holes?.[sub];
          if (hole) {
            const updatedHole = applySmartResultToPolygon(hole, result);
            let holes = (part.holes ?? []).map((h, i) => (i === sub ? updatedHole : h));
            // Extra Add Area islands become additional holes on the same Manual Detail.
            if (extraIslands.length) {
              const more = createSmartCutoutHoles(
                { ...result, points: extraIslands[0]!, regions: extraIslands.slice(1) },
                "Cutout",
                holes.length + 1,
              );
              holes = [...holes, ...more];
            }
            const next = partListRef.current.map((item, i) =>
              i === activePartIndexRef.current ? { ...item, holes } : item,
            );
            setEditPhase("transform");
            commitList(next, { bumpRevision: true });
            return;
          }
        }
      }

      if (smartApplyMode === "hole") {
        const part = partListRef.current[activePartIndexRef.current];
        if (part) {
          const start = (part.holes?.length ?? 0) + 1;
          const more = createSmartCutoutHoles(result, "Cutout", start);
          const holes = [...(part.holes ?? []), ...more];
          const next = partListRef.current.map((item, i) =>
            i === activePartIndexRef.current ? { ...item, holes } : item,
          );
          setActiveSubpath(holes.length - 1);
          setSmartEditTarget("active");
          setEditPhase("transform");
          commitList(next, { bumpRevision: true });
          return;
        }
      }
      const n =
        partListRef.current.filter((p) =>
          (p.label || "").toLowerCase().includes("smart cutout"),
        ).length + 1;
      // One Manual Detail for the whole detection (Add Area islands stay on this part).
      const part = createSmartCutoutFramePart(result, `Smart Cutout ${n}`, {
        depth: partListRef.current.length,
        layerOrder: "front",
      });
      const next = [...partListRef.current, part];
      setActiveSubpath("outer");
      setSmartEditTarget("active");
      setEditPhase("transform");
      commitList(next, {
        selectIndex: next.length - 1,
        bumpRevision: true,
      });
    },
    [commitList, smartApplyMode, smartEditTarget],
  );

  const switchSmartToManual = useCallback(
    (result: SmartCutoutResult) => {
      // Commit geometry first, then open Manual Polygon on the same cutout.
      applySmartCutout(result);
      setSmartEditTarget("active");
      setEditPhase("vertex");
    },
    [applySmartCutout],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = partListRef.current;
    const oldIndex = list.findIndex((part) => part.id === active.id);
    const newIndex = list.findIndex((part) => part.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(list, oldIndex, newIndex);
    const selectedId = list[activePartIndex]?.id;
    const selectIndex = selectedId
      ? Math.max(0, next.findIndex((part) => part.id === selectedId))
      : newIndex;
    commitList(next, { selectIndex });
  };

  if (editMode === "exclusions") {
    const lensOpenings = ensureFrameLensSet(
      initialMaskRef.current?.lenses ?? defaultLensSet(),
    );

    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Manual Details sit above the glass (rivets, screws, logos, inner lips). Prefer{" "}
          <span className="font-medium text-foreground">Smart Auto Detect</span> to click or brush a
          detail, then switch to{" "}
          <span className="font-medium text-foreground">Manual Polygon</span> for pixel-perfect
          tweaks.
        </p>

        <div className="rounded-md border border-border/70 bg-muted/10">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2.5 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Manual Details
            </p>
            <div className="relative shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => setShowAddMenu((open) => !open)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Detail
              </Button>
              {showAddMenu ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-background p-1.5 shadow-md">
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Starting shape
                  </p>
                  {START_SHAPES.map((shape) => (
                    <button
                      key={shape.value}
                      type="button"
                      className="flex w-full flex-col rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted/60"
                      onClick={() => addPart(shape.value)}
                    >
                      <span className="font-medium text-foreground">{shape.label}</span>
                      <span className="text-[10px] text-muted-foreground">{shape.hint}</span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-border/60" />
                  <button
                    type="button"
                    className="flex w-full flex-col rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted/60"
                    onClick={() => startNewSmartManualDetail()}
                  >
                    <span className="font-medium text-foreground">Smart Auto Detect</span>
                    <span className="text-[10px] text-muted-foreground">
                      Creates a new Manual Detail — click or brush to fill it
                    </span>
                  </button>
                  <div className="my-1 border-t border-border/60" />
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    From lens clip
                  </p>
                  {(["left", "right"] as FrameLensSide[]).map((side) => {
                    const lens = lensOpenings.find((l) => l.id === side);
                    const ready = (lens?.points?.length ?? 0) >= 3;
                    return (
                      <button
                        key={side}
                        type="button"
                        disabled={!ready}
                        className="flex w-full flex-col rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => addPartFromLens(side)}
                      >
                        <span className="font-medium text-foreground">
                          Duplicate {LENS_SIDE_LABELS[side]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {ready
                            ? "Uses the lens polygon as the outer path"
                            : "Draw the lens clip first"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {partList.length === 0 ? (
            <div className="space-y-2 px-2.5 py-2">
              <p className="text-[11px] text-muted-foreground">
                No manual details yet — add a shape, use Smart Auto Detect, or duplicate from a lens clip.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={() => startNewSmartManualDetail()}
              >
                Open Smart Auto Detect
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={partList.map((part) => part.id)}
                strategy={rectSortingStrategy}
              >
                <ul className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto p-2">
                  {partList.map((part, i) => (
                    <SortablePartChip
                      key={part.id}
                      id={part.id}
                      label={
                        (part.holes?.length ?? 0) > 0
                          ? `${part.label || `Part ${i + 1}`} (${part.holes!.length} hole${part.holes!.length === 1 ? "" : "s"})`
                          : part.label || `Part ${i + 1}`
                      }
                      active={i === activePartIndex}
                      visible={part.visible !== false}
                      onSelect={() => selectPart(i, "outer")}
                      onToggleVisible={(visible) => {
                        const next = partList.map((item, idx) =>
                          idx === i ? { ...item, visible } : item,
                        );
                        commitList(next);
                      }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {partList.length > 0 ? (
          <div className="min-w-0 space-y-3 rounded-md border border-border/70 bg-background/50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Detail properties
                </p>
                <p className="mt-0.5 text-xs font-medium text-foreground">
                  {activePart.label || `Part ${activePartIndex + 1}`}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={deleteSelectedElement}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={activePart.label}
                  onChange={(e) => patchActive({ label: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="e.g. Rivet L"
                />
              </div>

              <label className="flex h-8 items-center gap-2 text-xs sm:pb-0.5">
                <input
                  type="checkbox"
                  className="accent-foreground"
                  checked={activePart.visible !== false}
                  onChange={(e) => patchActive({ visible: e.target.checked })}
                />
                <span className="font-medium text-foreground">Visible</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Opacity</Label>
                <span className="tabular-nums text-[10px] text-muted-foreground">
                  {Math.round(activePart.opacity ?? 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={activePart.opacity ?? 100}
                onChange={(e) => patchActive({ opacity: Number(e.target.value) })}
                className="w-full accent-foreground"
              />
            </div>

            <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Detection settings
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {activeSubpath === "outer"
                    ? activePart.label || `Part ${activePartIndex + 1}`
                    : activePathPolygon?.label || `Cutout ${Number(activeSubpath) + 1}`}
                  {" · this path only"}
                </p>
              </div>
              <CutoutDetectSettingsFields
                settings={
                  editPhase === "smart" && smartEditTarget === "new"
                    ? draftDetectSettings
                    : getCutoutDetectSettings(activePathPolygon)
                }
                onChange={(next) => {
                  if (editPhase === "smart" && smartEditTarget === "new") {
                    setDraftDetectSettings(clampCutoutDetectSettings(next));
                    return;
                  }
                  patchActiveDetectSettings(next);
                }}
              />
            </div>

            <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Compound shape
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(() => {
                    const target =
                      activeSubpath === "outer"
                        ? activePart
                        : activeHoles[activeSubpath];
                    const preset = target?.shapePreset;
                    if (!preset) return null;
                    const edited = isShapeGeometryEdited(target);
                    return `${shapePresetLabel(preset)}${edited ? " · edited" : ""}`;
                  })()}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-left text-[11px] font-medium",
                    activeSubpath === "outer"
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => setActiveSubpath("outer")}
                >
                  Outer Polygon
                  {activePart.shapePreset
                    ? ` · ${shapePresetLabel(activePart.shapePreset)}`
                    : ""}
                </button>
                <p className="px-2 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Cutouts
                </p>
                {activeHoles.length === 0 ? (
                  <p className="px-2 text-[11px] text-muted-foreground">
                    No cutouts — add one for a transparent hole.
                  </p>
                ) : (
                  activeHoles.map((hole, hi) => (
                    <button
                      key={hole.id || hi}
                      type="button"
                      className={cn(
                        "rounded px-2 py-1 pl-4 text-left text-[11px]",
                        activeSubpath === hi
                          ? "bg-foreground text-background"
                          : "text-foreground hover:bg-muted/60",
                      )}
                      onClick={() => setActiveSubpath(hi)}
                    >
                      {hole.label || `Cutout ${hi + 1}`}
                      {hole.shapePreset
                        ? ` · ${shapePresetLabel(hole.shapePreset)}`
                        : ""}
                    </button>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => addCutout("free")}
                >
                  Create Cutout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => setShowInsetForm((v) => !v)}
                >
                  Create Inset Cutout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={activeSubpath === "outer"}
                  onClick={duplicateActiveCutout}
                >
                  Duplicate Cutout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-destructive hover:text-destructive"
                  disabled={activeSubpath === "outer"}
                  onClick={deleteActiveCutout}
                >
                  Delete Cutout
                </Button>
              </div>
              {showInsetForm ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Offset (px)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={48}
                      step={1}
                      value={insetPx}
                      onChange={(e) => setInsetPx(Math.max(1, Number(e.target.value) || 1))}
                      className="h-7 w-20 text-sm"
                    />
                  </div>
                  <Button type="button" size="sm" className="h-7" onClick={addInsetCutout}>
                    Generate Hole
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                disabled={!canUndo}
                onClick={undoManualDetails}
                title="Undo last Manual Details change (⌘Z / Ctrl+Z) — including Smart Detect steps"
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Undo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                disabled={!canRedo}
                onClick={redoManualDetails}
                title="Redo (⇧⌘Z / Ctrl+Y)"
              >
                <Redo2 className="mr-1 h-3.5 w-3.5" />
                Redo
              </Button>
              <span className="mx-0.5 text-border">|</span>
              <Button
                type="button"
                size="sm"
                variant={editPhase === "transform" ? "default" : "outline"}
                onClick={() => setEditPhase("transform")}
              >
                Transform
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editPhase === "smart" ? "default" : "outline"}
                onClick={() => {
                  setSmartEditTarget("active");
                  setSmartApplyMode(activeSubpath === "outer" ? "detail" : "hole");
                  setEditPhase("smart");
                }}
              >
                Smart Auto Detect
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editPhase === "vertex" ? "default" : "outline"}
                onClick={() => setEditPhase("vertex")}
              >
                Manual Polygon
              </Button>
              {(() => {
                const target =
                  activeSubpath === "outer"
                    ? activePart
                    : activeHoles[typeof activeSubpath === "number" ? activeSubpath : -1];
                const canReset =
                  target?.shapePreset === "rectangle" || target?.shapePreset === "ellipse";
                if (!canReset) return null;
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!isShapeGeometryEdited(target)}
                    onClick={resetActiveShape}
                    title={`Restore the original ${shapePresetLabel(target?.shapePreset)} after vertex edits`}
                  >
                    Reset Shape
                  </Button>
                );
              })()}
            </div>

            {editPhase === "smart" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Smart Auto Detect — click or brush a detail, use Add Area / more brush strokes for
                    extra pieces on the same cutout, Edit points to nudge vertices, then Apply.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditPhase("transform")}
                  >
                    Done
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2 text-[11px]">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="smart-edit-target"
                      className="accent-foreground"
                      checked={smartEditTarget === "active"}
                      onChange={() => setSmartEditTarget("active")}
                    />
                    <span>Update selected path</span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => startNewSmartManualDetail()}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    New Manual Detail
                  </Button>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="smart-edit-target"
                      className="accent-foreground"
                      checked={smartEditTarget === "new" && smartApplyMode === "hole"}
                      disabled={partList.length === 0}
                      onChange={() => {
                        beginNewSmartDraft();
                        setSmartApplyMode("hole");
                        setEditPhase("smart");
                      }}
                    />
                    <span>New hole on selected detail</span>
                  </label>
                </div>
                <SmartCutoutCanvas
                  key={`smart-${partRevision}-${lensRevision}-${activePart.id}-${String(activeSubpath)}-${smartEditTarget}`}
                  imageUrl={plateUrl}
                  initialPolygon={
                    smartEditTarget === "active"
                      ? activePathPolygon
                      : null
                  }
                  detectSettings={activeDetectSettings}
                  onDetectSettingsChange={patchActiveDetectSettings}
                  showDetectSettings={false}
                  onConfirm={applySmartCutout}
                  onSwitchToManual={switchSmartToManual}
                  historyHandleRef={smartHistoryHandleRef}
                  onHistoryChange={handleSmartHistoryChange}
                />
              </div>
            ) : editPhase === "transform" ? (
              <FramePartTransformCanvas
                key={`transform-${partRevision}-${lensRevision}`}
                imageUrl={plateUrl}
                parts={partList}
                activeIndex={activePartIndex}
                activeSubpath={activeSubpath}
                onSelect={(index) => {
                  setActivePartIndex(index);
                }}
                onSelectSubpath={setActiveSubpath}
                onCommitGeometry={commitTransformedGeometry}
                onEnterVertexEdit={(index) => {
                  selectPart(index, activeSubpath);
                  setEditPhase("vertex");
                }}
                snapToLensEdge={false}
                lensOpenings={lensOpenings}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Manual Polygon — add / move / delete points on the selected Outer or Cutout · Esc
                    returns to Transform.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditPhase("transform")}
                  >
                    Done
                  </Button>
                </div>
                <PolygonEditorShell
                  key={`${activePart.id}-vertex-${partRevision}-${lensRevision}`}
                  className="min-h-[280px]"
                  imageUrl={plateUrl}
                  getInitialLenses={() => [
                    {
                      id: activePart.id,
                      label: "Outer Polygon",
                      points: activePart.points ?? [],
                    },
                    ...activeHoles.map((hole, hi) => ({
                      id: hole.id || `cutout-${hi}`,
                      label: hole.label || `Cutout ${hi + 1}`,
                      points: hole.points ?? [],
                    })),
                  ]}
                  pathTabs={[
                    { id: activePart.id, label: "Outer" },
                    ...activeHoles.map((hole, hi) => ({
                      id: hole.id || `cutout-${hi}`,
                      label: hole.label || `Cutout ${hi + 1}`,
                    })),
                  ]}
                  defaultActivePathIndex={
                    activeSubpath === "outer" ? 0 : Math.min(activeSubpath + 1, activeHoles.length)
                  }
                  defaultTool={EditorTool.SELECT}
                  externalHistory
                  editorHandleRef={vertexEditorHandleRef}
                  onActivePathChange={(index) => {
                    setActiveSubpath(index <= 0 ? "outer" : index - 1);
                  }}
                  onLensesChange={handleLensesChange}
                  showLensTabs={false}
                  previewLabel="Frame part"
                  showThumbnailPreview={false}
                  lensRevision={partRevision + lensRevision}
                  handlesLabel="Control points"
                  helpText="Select: drag a vertex, drag inside the shape to move it, or click an edge to add a point · Del removes a point (min 3) · Undo/Redo use the Manual Details toolbar · Draw (P) appends points"
                />
              </div>
            )}
          </div>
        ) : editPhase === "smart" ? (
          <div className="min-w-0 space-y-3 rounded-md border border-border/70 bg-background/50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Smart Auto Detect
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Click or brush a frame detail to create a Manual Detail without tracing polygons.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditPhase("transform")}
              >
                Cancel
              </Button>
            </div>
            <SmartCutoutCanvas
              key={`smart-empty-${lensRevision}`}
              imageUrl={plateUrl}
              detectSettings={draftDetectSettings}
              onDetectSettingsChange={(next) =>
                setDraftDetectSettings(clampCutoutDetectSettings(next))
              }
              onConfirm={applySmartCutout}
              onSwitchToManual={switchSmartToManual}
              historyHandleRef={smartHistoryHandleRef}
              onHistoryChange={handleSmartHistoryChange}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <PolygonEditorShell
      className={cn(className)}
      imageUrl={plateUrl}
      getInitialLenses={() => {
        const mask = initialMaskRef.current;
        const focus = focusedLensIdRef.current;
        if (focus) {
          const full = mask?.lenses?.some((l) => (l.points?.length ?? 0) >= 1)
            ? ensureFrameLensSet(mask.lenses)
            : defaultLensSet();
          const lens = full.find((l) => l.id === focus) ?? full[0];
          return [lens];
        }
        if (mask?.lenses?.some((l) => (l.points?.length ?? 0) >= 1)) {
          return ensureFrameLensSet(mask.lenses);
        }
        return defaultLensSet();
      }}
      onLensesChange={handleLensesChange}
      lensRevision={lensRevision}
      showThumbnailPreview={false}
      showLensTabs={!focusedLensId}
      singlePathLabel={focusedLabel ?? "Lens path"}
      previewLabel={focusedLabel ? `${focusedLabel} overlay` : "Mask overlay"}
      handlesLabel="Control points"
      helpText={
        focusedLensId
          ? `Editing ${focusedLabel} only · Draw: click to add points · Shift+click edge to insert · Select (V) + Del removes · Undo ⌘Z · Redo ⇧⌘Z · Pan (H) or Space · C toggles curve`
          : "Left/Right lens tabs · Draw: click to add points · Shift+click edge to insert · Select (V) + Del removes · Undo ⌘Z · Redo ⇧⌘Z · Pan (H) or Space · C toggles curve on selected point"
      }
    />
  );
}

function SortablePartChip({
  id,
  label,
  active,
  visible,
  onSelect,
  onToggleVisible,
}: {
  id: string;
  label: string;
  active: boolean;
  visible: boolean;
  onSelect: () => void;
  onToggleVisible: (visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={cn("shrink-0", isDragging && "z-10 opacity-90")}>
      <div
        className={cn(
          "flex max-w-[12rem] items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] transition-colors",
          active
            ? "border-foreground bg-foreground text-background"
            : "border-border/70 bg-background text-foreground hover:bg-muted/60",
          !visible && !active && "opacity-50",
        )}
      >
        <button
          type="button"
          className={cn(
            "inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded touch-none active:cursor-grabbing",
            active ? "text-background/80" : "text-muted-foreground",
          )}
          aria-label={`Reorder ${label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <input
          type="checkbox"
          className="shrink-0 accent-foreground"
          checked={visible}
          onChange={(e) => onToggleVisible(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${visible ? "Hide" : "Show"} ${label}`}
        />
        <button
          type="button"
          className="min-w-0 flex-1 truncate py-0.5 pr-0.5 text-left font-medium"
          onClick={onSelect}
          title={label}
        >
          {label}
        </button>
      </div>
    </li>
  );
}
