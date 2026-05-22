import { useCallback, useRef } from "react";

import { cn } from "@/lib/utils";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import {
  createMaskConfig,
  defaultLensSet,
  isMaskConfigValid,
  pathsToMaskCanvas,
  type LensPolygon,
  type MaskConfig,
} from "@/render/mask";

interface FrameMaskEditorProps {
  plateUrl: string;
  width: number;
  height: number;
  initialMask?: MaskConfig | null;
  onChange?: (config: MaskConfig | null, valid: boolean) => void;
  className?: string;
}

/** Inline polygon mask editor (bino-rendering editor workflow). */
export function FrameMaskEditor({
  plateUrl,
  initialMask,
  onChange,
  className,
}: FrameMaskEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialMaskRef = useRef(initialMask);
  initialMaskRef.current = initialMask;

  const handleLensesChange = useCallback((lenses: LensPolygon[], meta: { imgW: number; imgH: number; valid: boolean }) => {
    const config = createMaskConfig(meta.imgW, meta.imgH, lenses);
    const valid = isMaskConfigValid(config);
    onChangeRef.current?.(valid ? config : null, valid);
  }, []);

  const renderPreview = useCallback((lenses: LensPolygon[], imgW: number, imgH: number, thumb: HTMLCanvasElement) => {
    const config = createMaskConfig(imgW, imgH, lenses);
    if (!isMaskConfigValid(config)) return;
    const mask = pathsToMaskCanvas(imgW, imgH, config.lenses);
    const ctx = thumb.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(thumb.width / imgW, thumb.height / imgH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, thumb.width, thumb.height);
    ctx.drawImage(mask, 0, 0, imgW, imgH, 0, 0, imgW * scale, imgH * scale);
  }, []);

  return (
    <PolygonEditorShell
      className={cn(className)}
      imageUrl={plateUrl}
      getInitialLenses={() =>
        initialMaskRef.current?.lenses?.length ? initialMaskRef.current.lenses : defaultLensSet()
      }
      onLensesChange={handleLensesChange}
      renderPreview={renderPreview}
      showLensTabs
      previewLabel="Mask preview"
      handlesLabel="Curve handles"
      helpText="Draw: click on the image to add anchors · Select · Pan (H) or Space · scroll to zoom · Del removes · C toggles curve"
    />
  );
}
