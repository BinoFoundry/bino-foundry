import { useCallback, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { FrameExclusionShape, LensClipConfig } from "@bino-foundry/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import { createLensPolygon, migrateAnchors, type LensPolygon, type PathAnchor } from "@/render/mask";
import { lensPolygonToPathD } from "@/render/lens-clip/svg-path-builder";
import { pathDToLensPolygon } from "@/render/lens-clip/clip-to-mask";
import { cn } from "@/lib/utils";

interface FrameExclusionRegionsEditorProps {
  plateUrl: string;
  imageWidth: number;
  imageHeight: number;
  clipConfig: LensClipConfig | null | undefined;
  onChange: (exclusions: FrameExclusionShape[]) => void;
  className?: string;
  disabled?: boolean;
}

function shapeToLens(ex: FrameExclusionShape, width: number, height: number, index: number): LensPolygon {
  const fromPath = pathDToLensPolygon(ex, width, height);
  if (fromPath) return fromPath;
  return createLensPolygon(ex.id || `excl-${index}`, ex.label || `Exclusion ${index + 1}`, []);
}

function lensToShape(lens: LensPolygon, width: number, height: number): FrameExclusionShape | null {
  const points = migrateAnchors(lens.points as PathAnchor[]);
  if (points.length < 3) return null;
  const pathD = lensPolygonToPathD({ id: lens.id, label: lens.label, points }, width, height);
  if (!pathD.trim()) return null;
  return { id: lens.id, label: lens.label || "Exclusion", pathD };
}

/**
 * Edit frame overlays that sit inside lens openings (bridge, screws, logos).
 * These stay separate from lens clip polygons and render above the synthetic lens.
 */
export function FrameExclusionRegionsEditor({
  plateUrl,
  imageWidth,
  imageHeight,
  clipConfig,
  onChange,
  className,
  disabled,
}: FrameExclusionRegionsEditorProps) {
  const [exclusions, setExclusions] = useState<FrameExclusionShape[]>(
    () => clipConfig?.frameExclusions ?? [],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const exclusionsRef = useRef(exclusions);
  exclusionsRef.current = exclusions;

  const commit = useCallback(
    (next: FrameExclusionShape[]) => {
      setExclusions(next);
      exclusionsRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const active =
    exclusions[activeIndex] ??
    ({
      id: `excl-${Date.now()}`,
      label: "Exclusion 1",
      pathD: "",
    } satisfies FrameExclusionShape);

  const handleLensesChange = useCallback(
    (lenses: LensPolygon[], meta: { imgW: number; imgH: number }) => {
      const edited = lenses[0];
      if (!edited) return;
      const shape = lensToShape(edited, meta.imgW, meta.imgH);
      const list = [...exclusionsRef.current];
      if (!list.length) {
        if (shape) commit([shape]);
        return;
      }
      const idx = Math.min(activeIndex, list.length - 1);
      if (shape) {
        list[idx] = { ...list[idx]!, ...shape, label: edited.label || list[idx]!.label };
      } else {
        list[idx] = {
          ...list[idx]!,
          id: edited.id,
          label: edited.label || list[idx]!.label,
          pathD: "",
        };
      }
      commit(list.filter((s) => s.pathD.trim().length > 8 || s === list[idx]));
    },
    [activeIndex, commit],
  );

  const addExclusion = () => {
    const next = [
      ...exclusions,
      { id: `excl-${Date.now()}`, label: `Exclusion ${exclusions.length + 1}`, pathD: "" },
    ];
    commit(next);
    setActiveIndex(next.length - 1);
    setRevision((r) => r + 1);
  };

  const removeActive = () => {
    if (!exclusions.length) return;
    const next = exclusions.filter((_, i) => i !== activeIndex);
    commit(next);
    setActiveIndex(Math.max(0, Math.min(activeIndex, next.length - 1)));
    setRevision((r) => r + 1);
  };

  const renameActive = (label: string) => {
    if (!exclusions.length) return;
    const next = exclusions.map((ex, i) => (i === activeIndex ? { ...ex, label } : ex));
    commit(next);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="type-label text-muted-foreground">Exclusion regions</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Draw polygons for frame parts that sit inside the lens opening. They render above the
          generated lens and are not merged into the clip path.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addExclusion}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add exclusion
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || exclusions.length === 0}
          onClick={removeActive}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Remove
        </Button>
      </div>

      {exclusions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {exclusions.map((ex, i) => (
            <button
              key={ex.id}
              type="button"
              className={cn(
                "rounded-md border px-2 py-1 text-[11px]",
                i === activeIndex
                  ? "border-foreground bg-background"
                  : "border-border text-muted-foreground",
              )}
              onClick={() => {
                setActiveIndex(i);
                setRevision((r) => r + 1);
              }}
            >
              {ex.label || `Exclusion ${i + 1}`}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No exclusions yet — add one to begin.</p>
      )}

      {exclusions.length > 0 ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Input
              value={active.label}
              disabled={disabled}
              onChange={(e) => renameActive(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <PolygonEditorShell
            key={`${active.id}-${revision}`}
            className="min-h-[280px]"
            imageUrl={plateUrl}
            getInitialLenses={() => [
              shapeToLens(exclusions[activeIndex] ?? active, imageWidth, imageHeight, activeIndex),
            ]}
            onLensesChange={handleLensesChange}
            showLensTabs={false}
            singlePathLabel={active.label || "Exclusion"}
            previewLabel="Exclusion overlay"
            showThumbnailPreview={false}
            lensRevision={revision}
          />
        </>
      ) : null}
    </div>
  );
}
