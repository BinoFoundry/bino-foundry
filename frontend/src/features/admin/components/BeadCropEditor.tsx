import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Scan } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import {
  beadCropConfigToEditorLenses,
  beadCropEditorPlateKey,
  computeBeadPhysicalMetricsForSave,
  detectBeadOutline,
  deliveryUrlsFromUploads,
  exportCroppedBeadDeliveryBlobs,
  isBeadCropEditorValid,
  loadImage,
  upgradeBeadCropOnSave,
} from "@/render/bead-crop";
import { pathsToMaskCanvas } from "@/render/mask/bezier-path";
import type { LensPolygon } from "@/render/mask/mask-types";
import { uploadApi } from "@/services/api/upload";
import { formatUploadErrorMessage, rollbackUploadedUrls } from "@/features/admin/lib/upload-pipeline";
import { beadSizesApi } from "@/services/api/bead-sizes";
import { useAdminDeveloperMode } from "@/features/admin/lib/developer-mode";
import {
  assetVisibleDiameterFromConfig,
  filterStaleNormalizationTargets,
  resolveNormalizedSizeTargets,
  saveNormalizedExportsForLibrary,
} from "@/features/admin/lib/normalized-bead-export";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import {
  createBeadCropConfigV2,
  getBeadCropPoints,
  isBeadCropConfigValid,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";

interface BeadCropEditorProps {
  originalUrl: string;
  initialCrop?: BeadCropConfig | null;
  libraryId?: string;
  enabledSizeMms?: number[];
  beadSizes?: BeadSizeEntry[];
  existingOffers?: BeadLibrarySizeOffer[];
  onDraftChange?: (config: BeadCropConfig | null, valid: boolean) => void;
  onSaveCrop?: (config: BeadCropConfig) => void;
  onProcessedUpload?: (processedUrl: string, config: BeadCropConfig) => void;
  onBeforeNormalizedExport?: () => Promise<void>;
  onNormalizedExportsSaved?: () => void | Promise<void>;
  onScheduleGroupRegen?: () => void;
  className?: string;
}

/**
 * Manual path/curve bead crop (same editor model as frame lens clips).
 * Live edits stay in draftRef; parent commits on Save crop / Save processed asset.
 */
export function BeadCropEditor({
  originalUrl,
  initialCrop,
  libraryId,
  enabledSizeMms = [],
  beadSizes = [],
  existingOffers = [],
  onDraftChange,
  onSaveCrop,
  onProcessedUpload,
  onBeforeNormalizedExport,
  onNormalizedExportsSaved,
  onScheduleGroupRegen,
  className,
}: BeadCropEditorProps) {
  const developerMode = useAdminDeveloperMode();
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
        const { points, confidence, detection } = detectBeadOutline(img);
        if (points.length < 3) {
          if (!options?.silent) {
            setExportStatus(
              "Could not detect bead silhouette — use a single bead on a plain white/light background, then try again.",
            );
          }
          return false;
        }

        const config = createBeadCropConfigV2(
          img.naturalWidth,
          img.naturalHeight,
          originalUrl,
          points,
          {
            scale: initialCropRef.current?.scale ?? 1,
            detection: detection
              ? {
                  autoDetected: true,
                  confidence,
                  contourPointCount: detection.contourPointCount,
                  pathPointCount: detection.pathPointCount,
                  curvedSegmentCount: detection.curvedSegmentCount,
                }
              : undefined,
          },
        );
        draftRef.current = config;
        setPathReady(isBeadCropConfigValid(config));
        setEditorSession((s) => s + 1);
        onDraftChangeRef.current?.(config, isBeadCropConfigValid(config));

        const confidenceLabel =
          confidence >= 0.75 ? "good" : confidence >= 0.5 ? "fair" : "low";
        const message = developerMode
          ? (() => {
              const detail = detection
                ? `${detection.pathPointCount} path points (${detection.curvedSegmentCount} curved) from ${detection.contourPointCount} contour samples`
                : `${points.length} path points`;
              return `Silhouette detected (${confidenceLabel} confidence, ${detail}) — refine if needed, then save.`;
            })()
          : "Outline detected — adjust if needed, then save.";
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
    [originalUrl, developerMode],
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
    const ctx = thumb.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(thumb.width / imgW, thumb.height / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, thumb.width, thumb.height);

    const mask = pathsToMaskCanvas(imgW, imgH, lenses);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(236, 72, 153, 0.55)";
    ctx.drawImage(mask, 0, 0, imgW, imgH, 0, 0, drawW, drawH);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(236, 72, 153, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const lens = lenses[0];
    if (lens && lens.points.length >= 2) {
      const pts = lens.points;
      const p0 = pts[0]!;
      ctx.moveTo(p0.x * drawW, p0.y * drawH);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]!;
        ctx.lineTo(p.x * drawW, p.y * drawH);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const commitCropPath = () => {
    const config = draftRef.current;
    if (!config || !isBeadCropConfigValid(config)) {
      toast.error("Draw a closed outline (at least 3 points) before saving.");
      return;
    }
    const points = getBeadCropPoints(config);
    const physicalMetrics =
      computeBeadPhysicalMetricsForSave(config.imageWidth, config.imageHeight, points) ??
      config.physicalMetrics;
    const committed = { ...config, physicalMetrics, updatedAt: Date.now() };
    draftRef.current = committed;
    onSaveCropRef.current?.(committed);
    setExportStatus("Crop saved");
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
      const blobs = await exportCroppedBeadDeliveryBlobs(config);
      const uploadedUrls: string[] = [];

      try {
        const pngUp = await uploadApi.uploadImage(new File([blobs.png], "bead-cropped.png", { type: "image/png" }));
        uploadedUrls.push(pngUp.imageUrl);

        const webpUp = await uploadApi.uploadImage(
          new File([blobs.webp], "bead-cropped.webp", { type: "image/webp" }),
        );
        uploadedUrls.push(webpUp.imageUrl);

        let avifUrl: string | null = null;
        if (blobs.avif?.size) {
          try {
            const avifUp = await uploadApi.uploadImage(
              new File([blobs.avif], "bead-cropped.avif", { type: "image/avif" }),
            );
            avifUrl = avifUp.imageUrl;
            uploadedUrls.push(avifUp.imageUrl);
          } catch {
            // Storage bucket may not allow image/avif — WebP/PNG are sufficient.
          }
        }

        const deliveryUrls = deliveryUrlsFromUploads({
          png: pngUp.imageUrl,
          webp: webpUp.imageUrl,
          avif: avifUrl,
        });

        const points = getBeadCropPoints(config);
        const physicalMetrics =
          computeBeadPhysicalMetricsForSave(config.imageWidth, config.imageHeight, points) ??
          config.physicalMetrics;

        const next = {
          ...config,
          processedUrl: pngUp.imageUrl,
          deliveryUrls,
          physicalMetrics: physicalMetrics ?? config.physicalMetrics,
          updatedAt: Date.now(),
        };
        draftRef.current = next;
        onProcessedUpload?.(pngUp.imageUrl, next);
        onSaveCropRef.current?.(next);

        if (libraryId && enabledSizeMms.length > 0) {
          await onBeforeNormalizedExport?.();
          const freshBeadSizes = await beadSizesApi.list();
          const assetVisible = assetVisibleDiameterFromConfig(next);
          const allTargets = resolveNormalizedSizeTargets(
            enabledSizeMms,
            freshBeadSizes,
            assetVisible,
          );
          const staleTargets = filterStaleNormalizationTargets(
            allTargets,
            existingOffers,
            assetVisible,
            next.updatedAt,
          );
          if (staleTargets.length > 0) {
            await saveNormalizedExportsForLibrary(libraryId, next, staleTargets, {
              existingOffers,
            });
            await onNormalizedExportsSaved?.();
            onScheduleGroupRegen?.();
            setExportStatus(
              developerMode
                ? `Processed asset saved · normalized ${staleTargets.length} size group(s)${
                    allTargets.length - staleTargets.length > 0
                      ? ` (${allTargets.length - staleTargets.length} unchanged)`
                      : ""
                  }`
                : "Image saved successfully",
            );
          } else {
            setExportStatus("Image saved successfully");
          }
        } else {
          setExportStatus("Image saved successfully");
        }
      } catch (uploadError) {
        await rollbackUploadedUrls(uploadedUrls);
        throw uploadError;
      }
    } catch (e) {
      const message = formatUploadErrorMessage(e);
      setExportStatus(message);
      toast.error(message);
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
            {busy ? "Saving…" : "Save image"}
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
        helpText={
          developerMode
            ? "Silhouette path overlays the bead — drag points, Shift+click edge to insert, C toggles curves · Undo ⌘Z · Pan (H) or Space"
            : "Drag the points to match the bead outline. Use Auto-detect outline for a quick start."
        }
      />

      {exportStatus ? <p className="text-xs text-muted-foreground">{exportStatus}</p> : null}
      {developerMode && initialCrop ? (
        <p className="text-[10px] text-muted-foreground">
          {initialCrop.version === 2
            ? "Editing saved crop path. Save crop stores outline changes; Save image uploads the cropped asset."
            : "Legacy rect crop loaded as corner points — refine, save crop, then save image."}
        </p>
      ) : null}
    </div>
  );
}

export { beadCropEditorPlateKey };
