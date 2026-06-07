import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import {
  beadCropConfigToEditorLenses,
  beadCropEditorPlateKey,
  detectBeadOutline,
  exportCroppedBeadBlob,
  isBeadCropEditorValid,
  loadImage,
  upgradeBeadCropOnSave,
} from "@/render/bead-crop";
import { pathsToMaskCanvas } from "@/render/mask/bezier-path";
import type { LensPolygon } from "@/render/mask/mask-types";
import { uploadApi } from "@/services/api/upload";
import {
  createBeadCropConfigV2,
  isBeadCropConfigValid,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";

interface BeadCropEditorProps {
  originalUrl: string;
  initialCrop?: BeadCropConfig | null;
  /** Live path edits (draft only — does not update parent form state). */
  onDraftChange?: (config: BeadCropConfig | null, valid: boolean) => void;
  /** Committed crop path saved to bead record (no processed PNG). */
  onSaveCrop?: (config: BeadCropConfig) => void;
  onProcessedUpload?: (processedUrl: string, config: BeadCropConfig) => void;
  className?: string;
}

/**
 * Manual path/curve bead crop (same editor model as frame lens clips).
 * Live edits stay in draftRef; parent commits on Save crop / Save processed asset.
 */
export function BeadCropEditor({
  originalUrl,
  initialCrop,
  onDraftChange,
  onSaveCrop,
  onProcessedUpload,
  className,
}: BeadCropEditorProps) {
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [pathReady, setPathReady] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const autoDetectAttemptedRef = useRef(false);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const onSaveCropRef = useRef(onSaveCrop);
  onSaveCropRef.current = onSaveCrop;
  const initialCropRef = useRef(initialCrop);
  initialCropRef.current = initialCrop;
  const draftRef = useRef<BeadCropConfig | null>(initialCrop ?? null);

  const applyDetectedOutline = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!originalUrl) return false;
      setDetecting(true);
      if (!options?.silent) setExportStatus("");
      try {
        const img = await loadImage(originalUrl);
        const { points, confidence } = detectBeadOutline(img);
        if (points.length < 3) {
          if (!options?.silent) {
            setExportStatus(
              "Could not detect bead — use a single bead on a plain white/light background, then try again.",
            );
          }
          return false;
        }

        const config = createBeadCropConfigV2(
          img.naturalWidth,
          img.naturalHeight,
          originalUrl,
          points,
          { scale: initialCropRef.current?.scale ?? 1 },
        );
        draftRef.current = config;
        setPathReady(isBeadCropConfigValid(config));
        setEditorSession((s) => s + 1);
        onDraftChangeRef.current?.(config, isBeadCropConfigValid(config));

        const confidenceLabel =
          confidence >= 0.75 ? "good" : confidence >= 0.5 ? "fair" : "low";
        const message = `Auto-detected outline (${confidenceLabel} confidence) — refine the path if needed, then save.`;
        if (!options?.silent || confidence >= 0.5) {
          setExportStatus(message);
        }
        return true;
      } catch (e) {
        if (!options?.silent) {
          setExportStatus(e instanceof Error ? e.message : "Auto-detect failed");
        }
        return false;
      } finally {
        setDetecting(false);
      }
    },
    [originalUrl],
  );

  useEffect(() => {
    if (!originalUrl || autoDetectAttemptedRef.current) return;
    const existing = initialCropRef.current;
    if (existing && isBeadCropConfigValid(existing)) return;

    autoDetectAttemptedRef.current = true;
    void applyDetectedOutline({ silent: true });
  }, [originalUrl, applyDetectedOutline]);

  const handleLensesChange = useCallback(
    (lenses: LensPolygon[], meta: { imgW: number; imgH: number; valid: boolean }) => {
      const config = upgradeBeadCropOnSave(
        initialCropRef.current ?? null,
        lenses,
        meta.imgW,
        meta.imgH,
        originalUrl,
      );
      draftRef.current = meta.valid ? config : null;
      setPathReady(meta.valid && isBeadCropConfigValid(config));
      onDraftChangeRef.current?.(meta.valid ? config : null, meta.valid && isBeadCropConfigValid(config));
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

  const commitCropPath = () => {
    const config = draftRef.current;
    if (!config || !isBeadCropConfigValid(config)) {
      alert("Draw a closed crop path (≥3 points) before saving.");
      return;
    }
    const committed = { ...config, updatedAt: Date.now() };
    draftRef.current = committed;
    onSaveCropRef.current?.(committed);
    setExportStatus("Crop path saved — export processed asset when ready");
  };

  const handleExport = async () => {
    let config = draftRef.current;
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
      const next = { ...config, processedUrl: uploaded.url, updatedAt: Date.now() };
      draftRef.current = next;
      onProcessedUpload?.(uploaded.url, next);
      onSaveCropRef.current?.(next);
      setExportStatus("Processed asset uploaded to storage");
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const cropReady = initialCrop && isBeadCropConfigValid(initialCrop);

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-muted/20 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Crop path</p>
          <p className="text-xs text-muted-foreground">
            <span className={cropReady || pathReady ? "text-status-success" : "text-status-warning"}>
              {cropReady ? "Saved path ready" : pathReady ? "Path ready — save crop" : "Draw the bead outline"}
            </span>
            {initialCrop?.processedUrl ? " · Processed asset on file" : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={detecting || busy}
            onClick={() => void applyDetectedOutline()}
          >
            <Scan className="mr-1.5 h-3.5 w-3.5" />
            {detecting ? "Detecting…" : "Auto-detect outline"}
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={!pathReady} onClick={commitCropPath}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Save crop
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !pathReady}
            onClick={() => void handleExport()}
          >
            {busy ? "Uploading…" : "Save processed asset"}
          </Button>
        </div>
      </div>

      <PolygonEditorShell
        key={`crop-editor-${editorSession}`}
        imageUrl={originalUrl}
        getInitialLenses={() => beadCropConfigToEditorLenses(draftRef.current ?? initialCropRef.current)}
        onLensesChange={handleLensesChange}
        renderPreview={renderPreview}
        showLensTabs={false}
        singlePathLabel="Crop boundary"
        previewLabel="Crop preview"
        handlesLabel="Bézier handles"
        helpText="Draw the visible bead boundary · Shift+click edge inserts point · Select (V) + Del removes · Undo ⌘Z · Redo ⇧⌘Z · Pan (H) or Space · C toggles curve"
      />

      {exportStatus ? <p className="text-xs text-muted-foreground">{exportStatus}</p> : null}
      {initialCrop ? (
        <p className="text-[10px] text-muted-foreground">
          {initialCrop.version === 2
            ? "Editing saved crop path. Use Save crop to store path changes; Save processed asset exports PNG for the strand."
            : "Legacy rect crop loaded as corner points — refine, Save crop, then export processed asset."}
        </p>
      ) : null}
    </div>
  );
}

export { beadCropEditorPlateKey };
