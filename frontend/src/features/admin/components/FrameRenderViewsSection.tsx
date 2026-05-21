import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isApiError, uploadApi } from "@/services/api";
import { isApiFrameId, renderingApi } from "@/services/api/rendering";
import type { FrameRenderView, FrameViewAxis } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES, FRAME_VIEW_LABELS } from "@/types/frame-rendering";
import type { MaskConfig } from "@/render/mask";
import { isMaskConfigValid } from "@/render/mask";

import { FrameMaskEditor } from "./FrameMaskEditor";

function emptyView(view: FrameViewAxis): FrameRenderView {
  return {
    view,
    plateUrl: "",
    width: 0,
    height: 0,
    maskConfig: null,
    maskStatus: "draft",
  };
}

function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    img.onerror = reject;
    img.src = url;
  });
}

interface FrameRenderViewsSectionProps {
  frameId?: string;
  views: FrameRenderView[];
  onChange: (views: FrameRenderView[]) => void;
}

/**
 * Front + side plate upload and inline mask editor (bino-rendering workflow in frame form).
 */
export function FrameRenderViewsSection({ frameId, views, onChange }: FrameRenderViewsSectionProps) {
  const [uploading, setUploading] = useState<FrameViewAxis | null>(null);
  const [editingView, setEditingView] = useState<FrameViewAxis | null>(null);
  const draftRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getView = useCallback(
    (axis: FrameViewAxis) => views.find((v) => v.view === axis) ?? emptyView(axis),
    [views],
  );

  const patchView = useCallback(
    (axis: FrameViewAxis, patch: Partial<FrameRenderView>) => {
      const next = FRAME_VIEW_AXES.map((v) => {
        const current = views.find((x) => x.view === v) ?? emptyView(v);
        return v === axis ? { ...current, ...patch, view: v } : current;
      });
      onChange(next);
    },
    [onChange, views],
  );

  const scheduleDraftSync = useCallback(
    (axis: FrameViewAxis, config: MaskConfig | null, valid: boolean) => {
      draftRef.current[axis] = config;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        patchView(axis, {
          maskConfig: config,
          maskStatus: valid ? "ready" : "draft",
        });
      }, 250);
    },
    [patchView],
  );

  useEffect(
    () => () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    },
    [],
  );

  const handleUpload = async (axis: FrameViewAxis, file: File) => {
    setUploading(axis);
    try {
      const { imageUrl } = await uploadApi.uploadImage(file);
      const { width, height } = await loadImageSize(imageUrl);
      draftRef.current[axis] = null;
      patchView(axis, {
        plateUrl: imageUrl,
        width,
        height,
        maskConfig: null,
        maskStatus: "draft",
      });
      setEditingView(axis);
    } catch (err) {
      const msg = isApiError(err) ? err.message : "Upload failed";
      alert(msg);
    } finally {
      setUploading(null);
    }
  };

  const commitViewMask = async (axis: FrameViewAxis) => {
    const config = draftRef.current[axis];
    const view = getView(axis);
    if (!view.plateUrl || !config || !isMaskConfigValid(config)) {
      alert("Complete the lens mask (3+ points on at least one lens) before saving.");
      return;
    }

    patchView(axis, { maskConfig: config, maskStatus: "ready" });

    if (frameId && isApiFrameId(frameId)) {
      try {
        await renderingApi.upsertView(frameId, axis, {
          plateUrl: view.plateUrl,
          imageWidth: view.width,
          imageHeight: view.height,
          maskConfig: config,
          maskStatus: "ready",
        });
      } catch (err) {
        console.warn("API mask sync failed (saved in form state)", err);
      }
    }
  };

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Render views</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload front and side (45°) photos, then draw lens masks inline. Points stay on the canvas while
          you edit — use <strong>Save mask</strong> when each view is complete.
        </p>
      </div>

      {FRAME_VIEW_AXES.map((axis) => {
        const view = getView(axis);
        const isEditing = editingView === axis;
        const hasPlate = Boolean(view.plateUrl);

        return (
          <div key={axis} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{FRAME_VIEW_LABELS[axis]}</p>
                {hasPlate ? (
                  <p className="text-xs text-muted-foreground">
                    {view.width}×{view.height} ·{" "}
                    <span className={view.maskStatus === "ready" ? "text-emerald-600" : "text-amber-600"}>
                      {view.maskStatus === "ready" ? "Mask ready" : "Mask in progress"}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No plate uploaded</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading === axis}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(axis, file);
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" asChild>
                    <span>
                      {uploading === axis ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {hasPlate ? "Replace photo" : "Upload photo"}
                    </span>
                  </Button>
                </label>
                {hasPlate ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={isEditing ? "default" : "secondary"}
                      onClick={() => setEditingView(isEditing ? null : axis)}
                    >
                      {isEditing ? "Hide mask editor" : "Edit mask"}
                    </Button>
                    {isEditing ? (
                      <Button type="button" size="sm" onClick={() => void commitViewMask(axis)}>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Save mask
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {hasPlate && isEditing ? (
              <FrameMaskEditor
                key={view.plateUrl}
                plateUrl={view.plateUrl}
                width={view.width}
                height={view.height}
                initialMask={view.maskConfig}
                onChange={(config, valid) => scheduleDraftSync(axis, config, valid)}
              />
            ) : hasPlate ? (
              <img
                src={view.plateUrl}
                alt={FRAME_VIEW_LABELS[axis]}
                className="mx-auto max-h-40 rounded-lg border border-border object-contain"
                crossOrigin="anonymous"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
