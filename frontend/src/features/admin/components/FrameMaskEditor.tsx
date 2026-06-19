import { useCallback, useRef } from "react";

import { cn } from "@/lib/utils";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import {
  createMaskConfig,
  defaultLensSet,
  ensureFrameLensSet,
  isMaskConfigValid,
  type FrameLensSide,
  LENS_SIDE_LABELS,
  type LensPolygon,
  type MaskConfig,
} from "@/render/mask";

interface FrameMaskEditorProps {
  plateUrl: string;
  width: number;
  height: number;
  initialMask?: MaskConfig | null;
  /** When set, editor focuses on one lens path only (left or right). */
  focusedLensId?: FrameLensSide;
  onChange?: (config: MaskConfig | null) => void;
  className?: string;
}

/** Lens clip path editor (polygon/curve tools → persisted as SVG clip paths). */
export function FrameMaskEditor({
  plateUrl,
  initialMask,
  focusedLensId,
  onChange,
  className,
}: FrameMaskEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialMaskRef = useRef(initialMask);
  initialMaskRef.current = initialMask;
  const focusedLensIdRef = useRef(focusedLensId);
  focusedLensIdRef.current = focusedLensId;

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
    return createMaskConfig(imgW, imgH, merged);
  }, []);

  const handleLensesChange = useCallback((lenses: LensPolygon[], meta: { imgW: number; imgH: number }) => {
    const config = focusedLensIdRef.current
      ? mergeFocusedEdit(lenses, meta.imgW, meta.imgH)
      : createMaskConfig(meta.imgW, meta.imgH, lenses);
    const valid = isMaskConfigValid(config);
    onChangeRef.current?.(valid ? config : null);
  }, [mergeFocusedEdit]);

  const focusedLabel = focusedLensId ? LENS_SIDE_LABELS[focusedLensId] : undefined;

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
