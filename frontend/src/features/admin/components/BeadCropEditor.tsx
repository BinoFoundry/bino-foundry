import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import {
  beadCropConfigToEditorLenses,
  exportCroppedBeadBlob,
  isBeadCropEditorValid,
  upgradeBeadCropOnSave,
} from "@/render/bead-crop";
import { pathsToMaskCanvas } from "@/render/mask/bezier-path";
import type { LensPolygon } from "@/render/mask/mask-types";
import { uploadApi } from "@/services/api/upload";
import {
  isBeadCropConfigValid,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";

interface BeadCropEditorProps {
  originalUrl: string;
  initialCrop?: BeadCropConfig | null;
  onChange?: (config: BeadCropConfig | null, valid: boolean) => void;
  onProcessedUpload?: (processedUrl: string, config: BeadCropConfig) => void;
  className?: string;
}

/** Manual path/curve crop editor (same interaction model as frame mask editor). */
export function BeadCropEditor({
  originalUrl,
  initialCrop,
  onChange,
  onProcessedUpload,
  className,
}: BeadCropEditorProps) {
  const [busy, setBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialCropRef = useRef(initialCrop);
  initialCropRef.current = initialCrop;
  const latestConfigRef = useRef<BeadCropConfig | null>(null);

  const handleLensesChange = useCallback(
    (lenses: LensPolygon[], meta: { imgW: number; imgH: number; valid: boolean }) => {
      const config = upgradeBeadCropOnSave(
        initialCropRef.current ?? null,
        lenses,
        meta.imgW,
        meta.imgH,
        originalUrl,
      );
      latestConfigRef.current = meta.valid ? config : null;
      const valid = meta.valid && isBeadCropConfigValid(config);
      onChangeRef.current?.(valid ? config : null, valid);
    },
    [originalUrl],
  );

  const renderPreview = useCallback((lenses: LensPolygon[], imgW: number, imgH: number, thumb: HTMLCanvasElement) => {
    if (!isBeadCropEditorValid(lenses)) return;
    const mask = pathsToMaskCanvas(imgW, imgH, lenses);
    const ctx = thumb.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(thumb.width / imgW, thumb.height / imgH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, thumb.width, thumb.height);
    ctx.drawImage(mask, 0, 0, imgW, imgH, 0, 0, imgW * scale, imgH * scale);
  }, []);

  const handleExport = async () => {
    const config = latestConfigRef.current;
    if (!config || !isBeadCropConfigValid(config)) {
      setExportStatus("Draw a closed crop path (≥3 points) first");
      return;
    }
    setBusy(true);
    setExportStatus("");
    try {
      const blob = await exportCroppedBeadBlob(config);
      const file = new File([blob], "bead-cropped.png", { type: "image/png" });
      const uploaded = await uploadApi.uploadImage(file);
      const next = { ...config, processedUrl: uploaded.url };
      latestConfigRef.current = next;
      onProcessedUpload?.(uploaded.url, next);
      onChangeRef.current?.(next, true);
      setExportStatus("Processed asset uploaded to storage");
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <PolygonEditorShell
        imageUrl={originalUrl}
        getInitialLenses={() => beadCropConfigToEditorLenses(initialCropRef.current)}
        onLensesChange={handleLensesChange}
        renderPreview={renderPreview}
        showLensTabs={false}
        previewLabel="Crop preview"
        handlesLabel="Bézier handles"
        helpText="Draw the visible bead boundary · Pan (H) or Space · scroll to zoom · Shift+click edge inserts point · Del removes · C toggles curve"
        headerExtra={
          <Button
            type="button"
            size="sm"
            variant="luxe"
            className="ml-auto"
            disabled={busy}
            onClick={() => void handleExport()}
          >
            {busy ? "Uploading…" : "Save processed asset"}
          </Button>
        }
        footerExtra={
          exportStatus ? (
            <p className="w-full text-xs text-muted-foreground">{exportStatus}</p>
          ) : null
        }
      />
      {initialCrop ? (
        <p className="text-[10px] text-muted-foreground">
          {initialCrop.version === 2
            ? "Editing saved crop path."
            : "Legacy rect crop loaded as corner points — refine and save processed asset."}
        </p>
      ) : null}
    </div>
  );
}
