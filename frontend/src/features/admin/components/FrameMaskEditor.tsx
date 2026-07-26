import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  useSortable,
  verticalListSortingStrategy,
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
} from "@/render/mask";
import type { FrameExclusionLayerOrder } from "@bino-foundry/shared/types";

export type LensEditorMode = "polygon" | "exclusions";

interface FrameMaskEditorProps {
  plateUrl: string;
  width: number;
  height: number;
  initialMask?: MaskConfig | null;
  /** Bump when initialMask paths change externally (auto-detect). */
  lensRevision?: number;
  /** When set, editor focuses on one lens path only (left or right). Polygon mode only. */
  focusedLensId?: FrameLensSide;
  /** Lens polygon editing vs glass occluders (frame structures inside the hole). */
  editMode?: LensEditorMode;
  onChange?: (config: MaskConfig | null) => void;
  className?: string;
}

function getFrameExclusions(mask: MaskConfig | null | undefined): LensPolygon[] {
  return resolveMaskFrameExclusions(mask);
}

/** List index → depth so compositor order matches the admin list within each layer. */
function withListOrderDepth(list: LensPolygon[]): LensPolygon[] {
  return list.map((ex, index) => ({ ...ex, depth: index }));
}

/** Editor paths for one compound occluder: [outer, ...holes]. */
function occluderToEditorPaths(occluder: LensPolygon): LensPolygon[] {
  const outer: LensPolygon = {
    id: occluder.id,
    label: "Outer",
    points: occluder.points ?? [],
  };
  const holes = (occluder.holes ?? []).map((hole, i) => ({
    id: hole.id || `${occluder.id}-hole-${i + 1}`,
    label: hole.label || `Hole ${i + 1}`,
    points: hole.points ?? [],
  }));
  return [outer, ...holes];
}

/** Merge editor paths back onto the occluder metadata. */
function editorPathsToOccluder(paths: LensPolygon[], previous: LensPolygon): LensPolygon {
  const outer = paths[0];
  const holePaths = paths.slice(1);
  return {
    ...previous,
    id: previous.id,
    // Keep the occluder display name — outer tab is always "Outer".
    label: previous.label,
    points: outer?.points ?? previous.points ?? [],
    holes: holePaths.map((hole, i) => ({
      id: hole.id || `${previous.id}-hole-${i + 1}`,
      label: hole.label?.startsWith("Hole") || hole.label === "Outer"
        ? `Hole ${i + 1}`
        : hole.label || `Hole ${i + 1}`,
      points: hole.points ?? [],
    })),
  };
}

const LAYER_OPTIONS: { value: FrameExclusionLayerOrder; label: string; hint: string }[] = [
  {
    value: "behind",
    label: "Behind Glass",
    hint: "Under the lens — tint and optics apply above it.",
  },
  {
    value: "front",
    label: "Above Glass",
    hint: "In front of the lens — optics do not affect it.",
  },
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

  const [activeExclusionIndex, setActiveExclusionIndex] = useState(0);
  const [exclusionRevision, setExclusionRevision] = useState(0);
  /** 0 = outer polygon; 1+ = hole index + 1 in editor path list. */
  const [activePathIndex, setActivePathIndex] = useState(0);

  const [exclusionList, setExclusionListState] = useState<LensPolygon[]>(() =>
    getFrameExclusions(initialMaskRef.current),
  );
  const exclusionListRef = useRef(exclusionList);
  const setExclusionList = useCallback((next: LensPolygon[]) => {
    exclusionListRef.current = next;
    setExclusionListState(next);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const emitExclusions = useCallback((list: LensPolygon[]) => {
    const ordered = withListOrderDepth(list);
    const mask = initialMaskRef.current;
    const baseLenses = ensureFrameLensSet(mask?.lenses ?? defaultLensSet());
    const config = createMaskConfig(
      mask?.imageWidth ?? 0,
      mask?.imageHeight ?? 0,
      baseLenses,
      undefined,
      ordered.filter((ex) => ex.points?.length),
    );
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  }, []);

  const commitList = useCallback(
    (list: LensPolygon[], options?: { selectIndex?: number; bumpRevision?: boolean }) => {
      const ordered = withListOrderDepth(list);
      setExclusionList(ordered);
      if (options?.selectIndex != null) {
        setActiveExclusionIndex(options.selectIndex);
      }
      if (options?.bumpRevision) {
        setExclusionRevision((r) => r + 1);
      }
      emitExclusions(ordered);
    },
    [emitExclusions, setExclusionList],
  );

  const patchActive = useCallback(
    (partial: Partial<LensPolygon>) => {
      if (!exclusionListRef.current.length) return;
      const next = exclusionListRef.current.map((ex, i) =>
        i === activeExclusionIndex ? { ...ex, ...partial } : ex,
      );
      commitList(next);
    },
    [activeExclusionIndex, commitList],
  );

  const mergeFocusedEdit = useCallback((edited: LensPolygon[], imgW: number, imgH: number): MaskConfig => {
    const focus = focusedLensIdRef.current;
    const editedLens = edited[0];
    const frameExclusions = getFrameExclusions(initialMaskRef.current);
    if (!focus || !editedLens) {
      return createMaskConfig(imgW, imgH, edited, undefined, frameExclusions);
    }

    const base = ensureFrameLensSet(initialMaskRef.current?.lenses ?? defaultLensSet());
    const merged = base.map((lens) =>
      lens.id === focus
        ? { ...lens, points: editedLens.points, label: LENS_SIDE_LABELS[focus] }
        : lens,
    );
    return createMaskConfig(imgW, imgH, merged, undefined, frameExclusions);
  }, []);

  const handleLensesChange = useCallback(
    (lenses: LensPolygon[], meta: { imgW: number; imgH: number }) => {
      if (editModeRef.current === "exclusions") {
        const next = [...exclusionListRef.current];
        if (next.length === 0) {
          if (lenses[0]) next.push({ ...lenses[0], holes: lenses.slice(1) });
        } else {
          const idx = Math.min(activeExclusionIndex, next.length - 1);
          next[idx] = editorPathsToOccluder(lenses, next[idx]!);
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
            getFrameExclusions(initialMaskRef.current),
          );

      onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
    },
    [activeExclusionIndex, commitList, mergeFocusedEdit],
  );

  const focusedLabel = focusedLensId ? LENS_SIDE_LABELS[focusedLensId] : undefined;
  const activeExclusion =
    exclusionList[activeExclusionIndex] ??
    createLensPolygon(
      `glass-occluder-${Date.now()}`,
      `Occluder ${activeExclusionIndex + 1}`,
      [],
      { layerOrder: "behind" },
    );

  const addExclusion = () => {
    const next = [
      ...exclusionListRef.current,
      createLensPolygon(
        `glass-occluder-${Date.now()}`,
        `Occluder ${exclusionListRef.current.length + 1}`,
        [],
        {
          layerOrder: "behind",
          opacity: 100,
          depth: exclusionListRef.current.length,
          visible: true,
          holes: [],
        },
      ),
    ];
    setActivePathIndex(0);
    commitList(next, { selectIndex: next.length - 1, bumpRevision: true });
  };

  const addHoleToActive = () => {
    const list = exclusionListRef.current;
    if (!list.length) return;
    const idx = Math.min(activeExclusionIndex, list.length - 1);
    const current = list[idx]!;
    const holeCount = current.holes?.length ?? 0;
    const hole = {
      id: `${current.id}-hole-${Date.now()}`,
      label: `Hole ${holeCount + 1}`,
      points: [] as LensPolygon["points"],
    };
    const next = list.map((ex, i) =>
      i === idx ? { ...ex, holes: [...(ex.holes ?? []), hole] } : ex,
    );
    setActivePathIndex(holeCount + 1);
    commitList(next, { bumpRevision: true });
  };

  const removeActiveHole = () => {
    if (activePathIndex <= 0) return;
    const list = exclusionListRef.current;
    if (!list.length) return;
    const idx = Math.min(activeExclusionIndex, list.length - 1);
    const current = list[idx]!;
    const holeIndex = activePathIndex - 1;
    const holes = [...(current.holes ?? [])];
    if (holeIndex < 0 || holeIndex >= holes.length) return;
    holes.splice(holeIndex, 1);
    const renumbered = holes.map((hole, i) => ({
      ...hole,
      label: `Hole ${i + 1}`,
    }));
    const next = list.map((ex, i) => (i === idx ? { ...ex, holes: renumbered } : ex));
    setActivePathIndex(Math.min(activePathIndex, renumbered.length));
    commitList(next, { bumpRevision: true });
  };

  const removeActiveExclusion = () => {
    if (!exclusionListRef.current.length) return;
    const next = exclusionListRef.current.filter((_, i) => i !== activeExclusionIndex);
    const nextIndex = next.length === 0 ? 0 : Math.min(activeExclusionIndex, next.length - 1);
    commitList(next, { selectIndex: nextIndex, bumpRevision: true });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = exclusionListRef.current;
    const oldIndex = list.findIndex((ex) => ex.id === active.id);
    const newIndex = list.findIndex((ex) => ex.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(list, oldIndex, newIndex);
    const selectedId = list[activeExclusionIndex]?.id;
    const selectIndex = selectedId
      ? Math.max(
          0,
          next.findIndex((ex) => ex.id === selectedId),
        )
      : newIndex;
    commitList(next, { selectIndex });
  };

  if (editMode === "exclusions") {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Glass Occluders are independent polygons for frame parts inside the lens opening. Select
          one from the list to edit its properties. Drag to reorder — list order matches render
          order within each layer.
        </p>

        <Button type="button" size="sm" variant="outline" onClick={addExclusion}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Occluder
        </Button>

        {exclusionList.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No glass occluders yet — add one to begin.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)] md:items-start">
            {/* Left: compact selectable list */}
            <div className="min-w-0 rounded-md border border-border/70 bg-muted/10">
              <p className="border-b border-border/60 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Occluder list
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={exclusionList.map((ex) => ex.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="max-h-[min(28rem,55vh)] overflow-y-auto p-1">
                    {exclusionList.map((ex, i) => (
                      <SortableOccluderRow
                        key={ex.id}
                        id={ex.id}
                        label={ex.label || `Occluder ${i + 1}`}
                        active={i === activeExclusionIndex}
                        visible={ex.visible !== false}
                        holeCount={ex.holes?.length ?? 0}
                        onSelect={() => {
                          setActiveExclusionIndex(i);
                          setActivePathIndex(0);
                          setExclusionRevision((r) => r + 1);
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>

            {/* Right: properties for the selected occluder */}
            <div className="min-w-0 space-y-3 rounded-md border border-border/70 bg-background/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Occluder properties
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {activeExclusion.label || `Occluder ${activeExclusionIndex + 1}`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={removeActiveExclusion}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={activeExclusion.label}
                  onChange={(e) => patchActive({ label: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="e.g. Nose Bridge"
                />
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="accent-foreground"
                  checked={activeExclusion.visible !== false}
                  onChange={(e) => patchActive({ visible: e.target.checked })}
                />
                <span className="font-medium text-foreground">Visible</span>
              </label>

              <fieldset className="space-y-2">
                <LegendLabel>Layer order</LegendLabel>
                {LAYER_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-2 text-xs"
                  >
                    <input
                      type="radio"
                      className="mt-0.5 accent-foreground"
                      name={`layer-${activeExclusion.id}`}
                      checked={
                        (activeExclusion.layerOrder ?? "behind") === option.value ||
                        (option.value === "behind" &&
                          (activeExclusion.layerOrder === "inside" ||
                            activeExclusion.layerOrder == null))
                      }
                      onChange={() => patchActive({ layerOrder: option.value })}
                    />
                    <span>
                      <span className="font-medium text-foreground">{option.label}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Opacity</Label>
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {Math.round(activeExclusion.opacity ?? 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={activeExclusion.opacity ?? 100}
                  onChange={(e) => patchActive({ opacity: Number(e.target.value) })}
                  className="w-full accent-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                <Input
                  value={activeExclusion.notes ?? ""}
                  onChange={(e) => patchActive({ notes: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="e.g. metal lip under lens"
                />
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">Compound polygon</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" variant="outline" onClick={addHoleToActive}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add Hole
                    </Button>
                    {activePathIndex > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={removeActiveHole}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete Hole
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
                  Draw the outer silhouette, then add holes to cut out inner regions (even-odd
                  compound path — like Illustrator / Figma).
                </p>
                <PolygonEditorShell
                  key={`${activeExclusion.id}-${exclusionRevision}-${lensRevision}`}
                  className="min-h-[280px]"
                  imageUrl={plateUrl}
                  getInitialLenses={() => occluderToEditorPaths(activeExclusion)}
                  onLensesChange={handleLensesChange}
                  showLensTabs={false}
                  pathTabs={[
                    { id: activeExclusion.id, label: "Outer" },
                    ...(activeExclusion.holes ?? []).map((hole, i) => ({
                      id: hole.id || `${activeExclusion.id}-hole-${i + 1}`,
                      label: hole.label || `Hole ${i + 1}`,
                    })),
                  ]}
                  defaultActivePathIndex={activePathIndex}
                  onActivePathChange={setActivePathIndex}
                  previewLabel="Occluder preview"
                  showThumbnailPreview={false}
                  lensRevision={exclusionRevision + lensRevision}
                  handlesLabel="Control points"
                  helpText="Outer + holes · Switch path tabs to edit · Shift+click edge to insert · Del removes selected point"
                />
              </div>
            </div>
          </div>
        )}
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

function SortableOccluderRow({
  id,
  label,
  active,
  visible,
  holeCount,
  onSelect,
}: {
  id: string;
  label: string;
  active: boolean;
  visible: boolean;
  holeCount: number;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "z-10 opacity-90")}>
      <div
        className={cn(
          "flex w-full items-center gap-1 rounded-sm px-1 py-1 text-left text-[11px] transition-colors",
          active
            ? "bg-foreground text-background"
            : "text-foreground hover:bg-muted/60",
          !visible && !active && "opacity-50",
        )}
      >
        <button
          type="button"
          className={cn(
            "inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded touch-none active:cursor-grabbing",
            active ? "text-background/80" : "text-muted-foreground",
          )}
          aria-label={`Reorder ${label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate py-0.5 text-left font-medium"
          onClick={onSelect}
        >
          <span
            className={cn(
              "mr-1.5 inline-block h-1.5 w-1.5 rounded-sm align-middle",
              active ? "bg-background" : visible ? "bg-foreground" : "bg-muted-foreground",
            )}
            aria-hidden
          />
          {label}
          {holeCount > 0 ? (
            <span
              className={cn(
                "ml-1 font-normal",
                active ? "text-background/70" : "text-muted-foreground",
              )}
            >
              · {holeCount} hole{holeCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </button>
      </div>
    </li>
  );
}

function LegendLabel({ children }: { children: ReactNode }) {
  return (
    <legend className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </legend>
  );
}
