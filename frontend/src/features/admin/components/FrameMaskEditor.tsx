import { useCallback, useRef, useState, type ReactNode } from "react";
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
  /** Lens polygon editing vs frame structure objects. */
  editMode?: LensEditorMode;
  onChange?: (config: MaskConfig | null) => void;
  className?: string;
}

function getFrameExclusions(mask: MaskConfig | null | undefined): LensPolygon[] {
  return resolveMaskFrameExclusions(mask);
}

const LAYER_OPTIONS: { value: FrameExclusionLayerOrder; label: string; hint: string }[] = [
  {
    value: "behind",
    label: "Behind Glass",
    hint: "Visible through the glass — tint and optics apply above it.",
  },
  {
    value: "inside",
    label: "Inside Glass",
    hint: "Embedded in the glass material.",
  },
  {
    value: "front",
    label: "Front of Glass",
    hint: "Renders above the glass — optics do not affect it.",
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
      list.filter((ex) => ex.points?.length),
    );
    onChangeRef.current?.(isMaskConfigValid(config) ? config : null);
  }, []);

  const patchActive = useCallback(
    (partial: Partial<LensPolygon>) => {
      if (!exclusionListRef.current.length) return;
      const next = exclusionListRef.current.map((ex, i) =>
        i === activeExclusionIndex ? { ...ex, ...partial } : ex,
      );
      setExclusionList(next);
      emitExclusions(next);
    },
    [activeExclusionIndex, emitExclusions, setExclusionList],
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
      `Frame object ${activeExclusionIndex + 1}`,
      [],
      { layerOrder: "behind" },
    );

  const addExclusion = () => {
    const next = [
      ...exclusionListRef.current,
      createLensPolygon(
        `frame-exclusion-${Date.now()}`,
        `Frame object ${exclusionListRef.current.length + 1}`,
        [],
        { layerOrder: "behind", opacity: 100, depth: 50, visible: true },
      ),
    ];
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

  if (editMode === "exclusions") {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Configure physical frame objects inside the lens openings (bridge support, screws, inner
          rim, nylon wire). Choose whether each sits behind, inside, or in front of the glass.
          Changes update the live preview immediately.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addExclusion}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add object
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
          <div className="space-y-2">
            {exclusionList.map((ex, i) => {
              const active = i === activeExclusionIndex;
              return (
                <button
                  key={ex.id}
                  type="button"
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-[11px] transition-colors",
                    active
                      ? "border-foreground bg-background"
                      : "border-border text-muted-foreground hover:border-foreground/40",
                    ex.visible === false && "opacity-60",
                  )}
                  onClick={() => {
                    setActiveExclusionIndex(i);
                    setExclusionRevision((r) => r + 1);
                  }}
                >
                  <span className="font-medium text-foreground">{ex.label || `Object ${i + 1}`}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {(ex.layerOrder ?? "behind") === "behind"
                      ? "Behind Glass"
                      : (ex.layerOrder ?? "behind") === "inside"
                        ? "Inside Glass"
                        : "Front of Glass"}
                    {" · "}
                    {Math.round(ex.opacity ?? 100)}% opacity
                    {ex.visible === false ? " · hidden" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No frame objects yet — add one to begin.
          </p>
        )}

        {exclusionList.length > 0 ? (
          <>
            <div className="space-y-3 rounded border border-border/70 bg-background/50 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={activeExclusion.label}
                  onChange={(e) => patchActive({ label: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <fieldset className="space-y-2">
                <LegendLabel>Layer</LegendLabel>
                {LAYER_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-2 text-xs"
                  >
                    <input
                      type="radio"
                      className="mt-0.5 accent-foreground"
                      name={`layer-${activeExclusion.id}`}
                      checked={(activeExclusion.layerOrder ?? "behind") === option.value}
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
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Depth</Label>
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {Math.round(activeExclusion.depth ?? 50)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Order within this layer — higher draws closer to the viewer.
                </p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={activeExclusion.depth ?? 50}
                  onChange={(e) => patchActive({ depth: Number(e.target.value) })}
                  className="w-full accent-foreground"
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
            </div>

            <PolygonEditorShell
              key={`${activeExclusion.id}-${exclusionRevision}-${lensRevision}`}
              className="min-h-[280px]"
              imageUrl={plateUrl}
              getInitialLenses={() => [activeExclusion]}
              onLensesChange={handleLensesChange}
              showLensTabs={false}
              singlePathLabel={activeExclusion.label || "Frame object"}
              previewLabel="Frame object"
              showThumbnailPreview={false}
              lensRevision={exclusionRevision + lensRevision}
              handlesLabel="Control points"
              helpText="Draw the object silhouette over the frame structure · Shift+click edge to insert · Del removes selected point"
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

function LegendLabel({ children }: { children: ReactNode }) {
  return (
    <legend className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </legend>
  );
}
