import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Scan } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PolygonEditorShell } from "@/render/editor/PolygonEditorShell";
import {
  beadCropConfigToEditorLenses,
  beadCropEditorPlateKey,
  isBeadCropEditorValid,
  upgradeBeadCropOnSave,
} from "@/render/bead-crop";
import { detectPlateCropConfig } from "@/render/frame-plate/crop";
import { pathsToMaskCanvas } from "@/render/mask/bezier-path";
import type { LensPolygon } from "@/render/mask/mask-types";
import {
  isBeadCropConfigValid,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";

export interface FramePlateCropEditorHandle {
  /** Returns committed draft or null when path is invalid. */
  commitDraft: () => BeadCropConfig | null;
  isPathReady: () => boolean;
  /** Apply auto-detected crop path into the live editor draft. */
  applyDraft: (config: BeadCropConfig) => void;
  /** Clear crop path draft (full original bounds). */
  resetDraft: () => void;
}

interface FramePlateCropEditorProps {
  originalUrl: string;
  imageWidth: number;
  imageHeight: number;
  initialCrop?: BeadCropConfig | null;
  /** When true, omit outer chrome — parent supplies InlineEditorPanel footer. */
  inline?: boolean;
  onDraftChange?: (config: BeadCropConfig | null, valid: boolean) => void;
  onSaveCrop?: (config: BeadCropConfig) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Path-based frame boundary editor — same PolygonEditorShell workflow as BeadCropEditor.
 */
export const FramePlateCropEditor = forwardRef<FramePlateCropEditorHandle, FramePlateCropEditorProps>(
  function FramePlateCropEditor(
    {
      originalUrl,
      initialCrop,
      inline = false,
      onDraftChange,
      onSaveCrop,
      onCancel,
      className,
    },
    ref,
  ) {
    const [detecting, setDetecting] = useState(false);
    const [status, setStatus] = useState("");
    const [pathReady, setPathReady] = useState(false);
    const [editorSession, setEditorSession] = useState(0);
    const onDraftChangeRef = useRef(onDraftChange);
    onDraftChangeRef.current = onDraftChange;
    const onSaveCropRef = useRef(onSaveCrop);
    onSaveCropRef.current = onSaveCrop;
    const initialCropRef = useRef(initialCrop);
    initialCropRef.current = initialCrop;
    const draftRef = useRef<BeadCropConfig | null>(initialCrop ?? null);

    const commitDraft = useCallback((): BeadCropConfig | null => {
      const config = draftRef.current;
      if (!config || !isBeadCropConfigValid(config)) return null;
      const committed = { ...config, updatedAt: Date.now() };
      draftRef.current = committed;
      return committed;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        commitDraft,
        isPathReady: () => pathReady,
        applyDraft: (config: BeadCropConfig) => {
          draftRef.current = config;
          setPathReady(isBeadCropConfigValid(config));
          setEditorSession((s) => s + 1);
          onDraftChangeRef.current?.(config, isBeadCropConfigValid(config));
        },
        resetDraft: () => {
          draftRef.current = null;
          setPathReady(false);
          setEditorSession((s) => s + 1);
          onDraftChangeRef.current?.(null, false);
          setStatus("");
        },
      }),
      [commitDraft, pathReady],
    );

    const applyDetectedOutline = useCallback(async () => {
      if (!originalUrl) return;
      setDetecting(true);
      setStatus("");
      try {
        const result = await detectPlateCropConfig(originalUrl);
        if (!result.config) {
          setStatus(result.message ?? "Could not detect frame outline.");
          return;
        }
        draftRef.current = result.config;
        setPathReady(isBeadCropConfigValid(result.config));
        setEditorSession((s) => s + 1);
        onDraftChangeRef.current?.(result.config, isBeadCropConfigValid(result.config));
        setStatus(result.message ?? "Outline detected.");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Auto-detect failed");
      } finally {
        setDetecting(false);
      }
    }, [originalUrl]);

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
        const ready = meta.valid && isBeadCropConfigValid(config);
        setPathReady(ready);
        onDraftChangeRef.current?.(meta.valid ? config : null, ready);
      },
      [originalUrl],
    );

    const renderPreview = useCallback(
      (lenses: LensPolygon[], imgW: number, imgH: number, thumb: HTMLCanvasElement) => {
        if (!isBeadCropEditorValid(lenses)) return;
        const mask = pathsToMaskCanvas(imgW, imgH, lenses);
        const ctx = thumb.getContext("2d");
        if (!ctx) return;
        const scale = Math.min(thumb.width / imgW, thumb.height / imgH);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, thumb.width, thumb.height);
        ctx.drawImage(mask, 0, 0, imgW, imgH, 0, 0, imgW * scale, imgH * scale);
      },
      [],
    );

    const handleLegacySave = () => {
      const committed = commitDraft();
      if (!committed) {
        toast.error("Draw a closed frame path (≥3 points) before saving.");
        return;
      }
      onSaveCropRef.current?.(committed);
      setStatus("Frame path saved to draft — applies when you save the frame.");
    };

    useEffect(() => {
      if (initialCrop && isBeadCropConfigValid(initialCrop)) {
        draftRef.current = initialCrop;
        setPathReady(true);
      }
    }, [initialCrop]);

    const cropReady = initialCrop && isBeadCropConfigValid(initialCrop);

    return (
      <div className={cn(inline ? "space-y-3" : "space-y-3 rounded-xl border border-border bg-background p-4", className)}>
        {!inline ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Frame boundary</p>
              <p className="text-xs text-muted-foreground">
                <span className={cropReady || pathReady ? "text-status-success" : "text-status-warning"}>
                  {cropReady
                    ? "Saved path ready"
                    : pathReady
                      ? "Path ready — save frame"
                      : "Draw how the frame should appear"}
                </span>
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={detecting}
              onClick={() => void applyDetectedOutline()}
            >
              <Scan className="mr-1.5 h-3.5 w-3.5" />
              {detecting ? "Detecting…" : "Auto-detect frame"}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={!pathReady} onClick={handleLegacySave}>
                Save frame path
              </Button>
              {onCancel ? (
                <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                  Close
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            <span className={pathReady ? "text-status-success" : "text-status-warning"}>
              {pathReady ? "Path ready" : "Draw the frame boundary on the photo"}
            </span>
          </p>
        )}

        <PolygonEditorShell
          key={`frame-crop-${beadCropEditorPlateKey(originalUrl, draftRef.current ?? initialCrop)}|${editorSession}`}
          imageUrl={originalUrl}
          getInitialLenses={() => beadCropConfigToEditorLenses(draftRef.current ?? initialCropRef.current)}
          onLensesChange={handleLensesChange}
          renderPreview={inline ? undefined : renderPreview}
          showThumbnailPreview={!inline}
          showLensTabs={false}
          singlePathLabel="Frame boundary"
          previewLabel="Boundary overlay"
          handlesLabel="Bézier handles"
          helpText="Draw the visible frame boundary · Shift+click edge inserts point · Select (V) + Del removes · Undo ⌘Z · Redo ⇧⌘Z · Pan (H) or Space · C toggles curve"
        />

        {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      </div>
    );
  },
);
