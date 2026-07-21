import { useCallback, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
  /** Lens polygon editing vs frame-level exclusion polygons. */
  editMode?: LensEditorMode;
  onChange?: (config: MaskConfig | null) => void;
  className?: string;
}

/** Frame-level exclusion polygons (independent of left/right). */
function getFrameExclusions(mask: MaskConfig | null | undefined): LensPolygon[] {
  return resolveMaskFrameExclusions(mask);
}

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

  // Frame exclusions are LOCAL editor state, seeded once from the incoming mask. They are the
  // source of truth while editing so the canvas is never torn down by the parent echoing back a
  // filtered mask (empty in-progress polygons would otherwise disappear mid-draw). We emit
  // upward on every change but never re-derive the list from props.
  const [exclusionList, setExclusionListState] = useState<LensPolygon[]>(() =>
    getFrameExclusions(initialMaskRef.current),
  );
  const exclusionListRef = useRef(exclusionList);
  const setExclusionList = useCallback((next: LensPolygon[]) => {
    exclusionListRef.current = next;
    setExclusionListState(next);
  }, []);

  const emitExclusions = useCallback((list: LensPolygon[]) => {
    const mask = initialMaskRef.current;
    const baseLenses = ensureFrameLensSet(mask?.lenses ?? defaultLensSet());
    const config = createMaskConfig(
      mask?.imageWidth ?? 0,
      mask?.imageHeight ?? 0,
      baseLenses,
      undefined,
      // Empty in-progress polygons are dropped from the emitted mask (they carry no path),
      // but stay in local state so the user can keep drawing them.
      list.filter((ex) => ex.points?.length),
    );
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  }, []);

  const mergeFocusedEdit = useCallback((edited: LensPolygon[], imgW: number, imgH: number): MaskConfig => {
    const focus = focusedLensIdRef.current;
    const editedLens = edited[0];
    // Carry frame-level exclusions through lens polygon edits so they are never lost.
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
        const editedPolygon = lenses[0];
        const next = [...exclusionListRef.current];
        if (editedPolygon) {
          if (next.length === 0) {
            next.push(editedPolygon);
          } else {
            const idx = Math.min(activeExclusionIndex, next.length - 1);
            next[idx] = {
              ...next[idx]!,
              id: editedPolygon.id,
              label: editedPolygon.label || next[idx]!.label,
              points: editedPolygon.points,
            };
          }
        }
        setExclusionList(next);
        emitExclusions(next);
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
    [activeExclusionIndex, emitExclusions, mergeFocusedEdit, setExclusionList],
  );

  const focusedLabel = focusedLensId ? LENS_SIDE_LABELS[focusedLensId] : undefined;
  const activeExclusion =
    exclusionList[activeExclusionIndex] ??
    createLensPolygon(
      `frame-exclusion-${Date.now()}`,
      `Exclusion ${activeExclusionIndex + 1}`,
      [],
    );

  const addExclusion = () => {
    const next = [
      ...exclusionListRef.current,
      createLensPolygon(
        `frame-exclusion-${Date.now()}`,
        `Exclusion ${exclusionListRef.current.length + 1}`,
        [],
      ),
    ];
    // Bump the revision only on add — this remounts the canvas onto the new polygon. It never
    // fires while drawing, so the canvas stays put between clicks.
    setExclusionList(next);
    setActiveExclusionIndex(next.length - 1);
    setExclusionRevision((r) => r + 1);
    emitExclusions(next);
  };

  const removeActiveExclusion = () => {
    if (!exclusionListRef.current.length) return;
    const next = exclusionListRef.current.filter((_, i) => i !== activeExclusionIndex);
    setExclusionList(next);
    setActiveExclusionIndex(Math.max(0, Math.min(activeExclusionIndex, next.length - 1)));
    setExclusionRevision((r) => r + 1);
    emitExclusions(next);
  };

  const renameActiveExclusion = (label: string) => {
    if (!exclusionListRef.current.length) return;
    const next = exclusionListRef.current.map((ex, i) =>
      i === activeExclusionIndex ? { ...ex, label } : ex,
    );
    setExclusionList(next);
    emitExclusions(next);
  };

  if (editMode === "exclusions") {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Draw polygons for frame parts inside the lens openings (bridge, screws, inner rim,
          support bars). These restore the original frame above the rendered lens, so they stay
          fully visible regardless of tint.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addExclusion}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add exclusion
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={exclusionList.length === 0}
            onClick={removeActiveExclusion}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        </div>

        {exclusionList.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {exclusionList.map((ex, i) => (
              <button
                key={ex.id}
                type="button"
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px]",
                  i === activeExclusionIndex
                    ? "border-foreground bg-background"
                    : "border-border text-muted-foreground",
                )}
                onClick={() => {
                  setActiveExclusionIndex(i);
                  setExclusionRevision((r) => r + 1);
                }}
              >
                {ex.label || `Exclusion ${i + 1}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No frame exclusions yet — add one to begin.
          </p>
        )}

        {exclusionList.length > 0 ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={activeExclusion.label}
                onChange={(e) => renameActiveExclusion(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <PolygonEditorShell
              key={`${activeExclusion.id}-${exclusionRevision}-${lensRevision}`}
              className="min-h-[280px]"
              imageUrl={plateUrl}
              getInitialLenses={() => [activeExclusion]}
              onLensesChange={handleLensesChange}
              showLensTabs={false}
              singlePathLabel={activeExclusion.label || "Exclusion"}
              previewLabel="Frame exclusion"
              showThumbnailPreview={false}
              lensRevision={exclusionRevision + lensRevision}
              handlesLabel="Control points"
              helpText="Draw closed exclusion polygons over frame parts · Shift+click edge to insert · Del removes selected point"
            />
          </>
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
