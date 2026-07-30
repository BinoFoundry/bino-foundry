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
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
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
  type FramePartStartShape,
} from "@/features/admin/lib/frame-parts";
import { FramePartTransformCanvas } from "@/features/admin/components/FramePartTransformCanvas";

/** Internal mode id kept for persistence wiring; UI copy says Manual Details. */
export type LensEditorMode = "polygon" | "exclusions";

type PartEditPhase = "transform" | "vertex";

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
    holes: [],
    layerOrder: "front",
  }));
}

const START_SHAPES: { value: FramePartStartShape; label: string; hint: string }[] = [
  { value: "rectangle", label: "Rectangle", hint: "Quick box — transform, then refine." },
  { value: "ellipse", label: "Ellipse", hint: "Rounded starting shape." },
  { value: "free", label: "Free Polygon", hint: "Empty path — draw vertices yourself." },
];

/** Lens clip path editor (polygon/curve tools → persisted as SVG clip paths). */
export function FrameMaskEditor({
  plateUrl,
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
  const [partRevision, setPartRevision] = useState(0);
  const [editPhase, setEditPhase] = useState<PartEditPhase>("transform");
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [partList, setPartListState] = useState<LensPolygon[]>(() =>
    getFrameParts(initialMaskRef.current),
  );
  const partListRef = useRef(partList);
  const setPartList = useCallback((next: LensPolygon[]) => {
    partListRef.current = next;
    setPartListState(next);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    if (editMode !== "exclusions" || editPhase !== "vertex") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setEditPhase("transform");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode, editPhase]);

  const emitParts = useCallback((list: LensPolygon[]) => {
    const ordered = withListOrderDepth(list);
    const mask = initialMaskRef.current;
    const baseLenses = ensureFrameLensSet(mask?.lenses ?? defaultLensSet());
    const config = createMaskConfig(
      mask?.imageWidth ?? 0,
      mask?.imageHeight ?? 0,
      baseLenses,
      undefined,
      ordered.filter((part) => (part.points?.length ?? 0) >= 1),
    );
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  }, []);

  const commitList = useCallback(
    (list: LensPolygon[], options?: { selectIndex?: number; bumpRevision?: boolean }) => {
      const ordered = withListOrderDepth(list);
      setPartList(ordered);
      if (options?.selectIndex != null) {
        setActivePartIndex(options.selectIndex);
      }
      if (options?.bumpRevision) {
        setPartRevision((r) => r + 1);
      }
      emitParts(ordered);
    },
    [emitParts, setPartList],
  );

  const patchActive = useCallback(
    (partial: Partial<LensPolygon>) => {
      if (!partListRef.current.length) return;
      const next = partListRef.current.map((part, i) =>
        i === activePartIndex ? { ...part, ...partial, holes: [] } : part,
      );
      commitList(next);
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
        const edited = lenses[0];
        const next = [...partListRef.current];
        if (!edited) {
          commitList(next);
          return;
        }
        if (next.length === 0) {
          next.push({ ...edited, holes: [] });
        } else {
          const idx = Math.min(activePartIndex, next.length - 1);
          next[idx] = {
            ...next[idx]!,
            id: next[idx]!.id,
            label: next[idx]!.label,
            points: edited.points,
            holes: [],
          };
        }
        commitList(next);
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

  const addPart = (shape: FramePartStartShape) => {
    const next = [
      ...partListRef.current,
      createFramePart(`Part ${partListRef.current.length + 1}`, shape, {
        depth: partListRef.current.length,
      }),
    ];
    setShowAddMenu(false);
    setEditPhase(shape === "free" ? "vertex" : "transform");
    commitList(next, { selectIndex: next.length - 1, bumpRevision: true });
  };

  const removeActivePart = () => {
    if (!partListRef.current.length) return;
    const next = partListRef.current.filter((_, i) => i !== activePartIndex);
    const nextIndex = next.length === 0 ? 0 : Math.min(activePartIndex, next.length - 1);
    setEditPhase("transform");
    commitList(next, { selectIndex: nextIndex, bumpRevision: true });
  };

  const commitTransformedPoints = (index: number, points: PathAnchor[]) => {
    const next = partListRef.current.map((part, i) =>
      i === index ? { ...part, points, holes: [] } : part,
    );
    commitList(next);
  };

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
          Manual Details sit above the glass (rivets, screws, logos). Drag to move, use handles to
          scale and rotate. Double-click only when you need vertex-level edits. The Inner Frame lip
          is automatic — edit it under Lens rendering.
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
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-background p-1.5 shadow-md">
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
                </div>
              ) : null}
            </div>
          </div>

          {partList.length === 0 ? (
            <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
              No manual details yet — add a rectangle or ellipse to begin.
            </p>
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
                      label={part.label || `Part ${i + 1}`}
                      active={i === activePartIndex}
                      visible={part.visible !== false}
                      onSelect={() => {
                        setActivePartIndex(i);
                        setEditPhase("transform");
                        setPartRevision((r) => r + 1);
                      }}
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
                onClick={removeActivePart}
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

            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
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
                variant={editPhase === "vertex" ? "default" : "outline"}
                onClick={() => setEditPhase("vertex")}
              >
                Edit vertices
              </Button>
            </div>

            {editPhase === "transform" ? (
              <FramePartTransformCanvas
                key={`transform-${partRevision}-${lensRevision}`}
                imageUrl={plateUrl}
                parts={partList}
                activeIndex={activePartIndex}
                onSelect={setActivePartIndex}
                onCommitPoints={commitTransformedPoints}
                onEnterVertexEdit={(index) => {
                  setActivePartIndex(index);
                  setEditPhase("vertex");
                  setPartRevision((r) => r + 1);
                }}
                // Reserved architecture hook — not active yet.
                snapToLensEdge={false}
                lensOpenings={lensOpenings}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Vertex mode — Esc or Transform returns to move / scale / rotate.
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
                      label: activePart.label || "Frame part",
                      points: activePart.points ?? [],
                    },
                  ]}
                  onLensesChange={handleLensesChange}
                  showLensTabs={false}
                  singlePathLabel={activePart.label || "Frame part"}
                  previewLabel="Frame part"
                  showThumbnailPreview={false}
                  lensRevision={partRevision + lensRevision}
                  handlesLabel="Control points"
                  helpText="Fine-tune vertices · Shift+click edge to insert · Del removes selected point"
                />
              </div>
            )}
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
