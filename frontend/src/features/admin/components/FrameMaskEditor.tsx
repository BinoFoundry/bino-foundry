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
  /** When set, editor focuses on one lens path only (left or right). */
  focusedLensId?: FrameLensSide;
  /** Lens polygon vs per-lens exclusion holes. */
  editMode?: LensEditorMode;
  onChange?: (config: MaskConfig | null) => void;
  className?: string;
}

function getSideExclusions(mask: MaskConfig | null | undefined, side: FrameLensSide): LensPolygon[] {
  return mask?.exclusions?.[side] ?? [];
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

  const mergeFocusedEdit = useCallback((edited: LensPolygon[], imgW: number, imgH: number): MaskConfig => {
    const focus = focusedLensIdRef.current;
    const editedLens = edited[0];
    if (!focus || !editedLens) {
      return createMaskConfig(imgW, imgH, edited);
    }

    const base = ensureFrameLensSet(initialMaskRef.current?.lenses ?? defaultLensSet());
    const merged = base.map((lens) =>
      lens.id === focus
        ? { ...lens, points: editedLens.points, label: LENS_SIDE_LABELS[focus] }
        : lens,
    );
    return createMaskConfig(imgW, imgH, merged, initialMaskRef.current?.exclusions);
  }, []);

  const mergeFocusedExclusionEdit = useCallback(
    (edited: LensPolygon[], imgW: number, imgH: number, activeIndex: number): MaskConfig => {
      const focus = focusedLensIdRef.current;
      const editedExclusion = edited[0];
      const baseMask = initialMaskRef.current;
      const baseLenses = ensureFrameLensSet(baseMask?.lenses ?? defaultLensSet());
      const sideExclusions = [...getSideExclusions(baseMask, focus ?? "left")];

      if (focus && editedExclusion) {
        if (sideExclusions.length === 0) {
          sideExclusions.push(editedExclusion);
        } else {
          const idx = Math.min(activeIndex, sideExclusions.length - 1);
          sideExclusions[idx] = {
            ...sideExclusions[idx]!,
            id: editedExclusion.id,
            label: editedExclusion.label || sideExclusions[idx]!.label,
            points: editedExclusion.points,
          };
        }
      }

      const exclusions = {
        ...(baseMask?.exclusions ?? {}),
        ...(focus ? { [focus]: sideExclusions.filter((ex) => ex.points?.length) } : {}),
      };

      return createMaskConfig(imgW, imgH, baseLenses, exclusions);
    },
    [],
  );

  const handleLensesChange = useCallback(
    (lenses: LensPolygon[], meta: { imgW: number; imgH: number }) => {
      const mode = editModeRef.current;
      const config =
        mode === "exclusions" && focusedLensIdRef.current
          ? mergeFocusedExclusionEdit(lenses, meta.imgW, meta.imgH, activeExclusionIndex)
          : focusedLensIdRef.current
            ? mergeFocusedEdit(lenses, meta.imgW, meta.imgH)
            : createMaskConfig(meta.imgW, meta.imgH, lenses, initialMaskRef.current?.exclusions);

      const valid =
        mode === "exclusions"
          ? Boolean(config && isMaskConfigValid(config))
          : isMaskConfigValid(config);
      onChangeRef.current?.(valid ? config : null);
    },
    [activeExclusionIndex, mergeFocusedEdit, mergeFocusedExclusionEdit],
  );

  const focusedLabel = focusedLensId ? LENS_SIDE_LABELS[focusedLensId] : undefined;
  const sideExclusions = focusedLensId ? getSideExclusions(initialMask, focusedLensId) : [];
  const activeExclusion =
    sideExclusions[activeExclusionIndex] ??
    createLensPolygon(
      `excl-${focusedLensId ?? "lens"}-${Date.now()}`,
      `Exclusion ${activeExclusionIndex + 1}`,
      [],
    );

  const addExclusion = () => {
    if (!focusedLensId || !initialMaskRef.current) return;
    const nextExclusion = createLensPolygon(
      `excl-${focusedLensId}-${Date.now()}`,
      `Exclusion ${sideExclusions.length + 1}`,
      [],
    );
    const exclusions = {
      ...(initialMaskRef.current.exclusions ?? {}),
      [focusedLensId]: [...sideExclusions, nextExclusion],
    };
    const config = createMaskConfig(
      initialMaskRef.current.imageWidth,
      initialMaskRef.current.imageHeight,
      ensureFrameLensSet(initialMaskRef.current.lenses),
      exclusions,
    );
    setActiveExclusionIndex(sideExclusions.length);
    setExclusionRevision((r) => r + 1);
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  };

  const removeActiveExclusion = () => {
    if (!focusedLensId || !initialMaskRef.current || !sideExclusions.length) return;
    const nextList = sideExclusions.filter((_, i) => i !== activeExclusionIndex);
    const exclusions = {
      ...(initialMaskRef.current.exclusions ?? {}),
      [focusedLensId]: nextList,
    };
    const config = createMaskConfig(
      initialMaskRef.current.imageWidth,
      initialMaskRef.current.imageHeight,
      ensureFrameLensSet(initialMaskRef.current.lenses),
      exclusions,
    );
    setActiveExclusionIndex(Math.max(0, Math.min(activeExclusionIndex, nextList.length - 1)));
    setExclusionRevision((r) => r + 1);
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  };

  const renameActiveExclusion = (label: string) => {
    if (!focusedLensId || !initialMaskRef.current || !sideExclusions.length) return;
    const nextList = sideExclusions.map((ex, i) =>
      i === activeExclusionIndex ? { ...ex, label } : ex,
    );
    const exclusions = {
      ...(initialMaskRef.current.exclusions ?? {}),
      [focusedLensId]: nextList,
    };
    const config = createMaskConfig(
      initialMaskRef.current.imageWidth,
      initialMaskRef.current.imageHeight,
      ensureFrameLensSet(initialMaskRef.current.lenses),
      exclusions,
    );
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  };

  if (editMode === "exclusions" && focusedLensId) {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Draw polygons for frame parts inside the {focusedLabel?.toLowerCase()} opening. Excluded
          areas stay untinted — the original frame shows through.
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
            disabled={sideExclusions.length === 0}
            onClick={removeActiveExclusion}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        </div>

        {sideExclusions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {sideExclusions.map((ex, i) => (
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
            No exclusion areas yet — add one to begin.
          </p>
        )}

        {sideExclusions.length > 0 ? (
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
              previewLabel={`${focusedLabel} exclusion`}
              showThumbnailPreview={false}
              lensRevision={exclusionRevision + lensRevision}
              handlesLabel="Control points"
              helpText="Draw closed exclusion polygons inside the lens opening · Shift+click edge to insert · Del removes selected point"
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
