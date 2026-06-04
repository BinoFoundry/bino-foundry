import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isApiError, uploadApi } from "@/services/api";
import { isApiFrameId, renderingApi } from "@/services/api/rendering";
import type { FrameRenderView, FrameViewAxis } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES, FRAME_VIEW_LABELS } from "@/types/frame-rendering";
import { editorPlateKey, maskConfigToLensClipConfig, resolveMaskConfigForEditor } from "@/render/lens-clip";
import { isMaskConfigValid, type MaskConfig } from "@/render/mask";
import { isLensClipConfigValid } from "@bino-foundry/shared/types";

import { LoadingState } from "@/components/common";

const FrameMaskEditor = lazy(() =>
  import("./FrameMaskEditor").then((m) => ({ default: m.FrameMaskEditor })),
);

function emptyView(view: FrameViewAxis): FrameRenderView {
  return {
    view,
    plateUrl: "",
    width: 0,
    height: 0,
    clipConfig: null,
    clipStatus: "draft",
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
 * Front + side plate upload and SVG lens clip editor (polygon editor → SVG paths).
 */
export function FrameRenderViewsSection({ frameId, views, onChange }: FrameRenderViewsSectionProps) {
  const [uploading, setUploading] = useState<FrameViewAxis | null>(null);
  const [editingView, setEditingView] = useState<FrameViewAxis | null>(null);
  /** Bumped only when user opens the editor — stable during live edits (avoids remount loop). */
  const [editSession, setEditSession] = useState<Partial<Record<FrameViewAxis, number>>>({});
  const draftRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});

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

  /** Live edits stay in draftRef only — do not patch parent (would change keys / re-render loop). */
  const handleEditorChange = useCallback((axis: FrameViewAxis, mask: MaskConfig | null) => {
    draftRef.current[axis] = mask;
  }, []);

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
        clipConfig: null,
        clipStatus: "draft",
      });
      setEditingView(axis);
    } catch (err) {
      const msg = isApiError(err) ? err.message : "Upload failed";
      alert(msg);
    } finally {
      setUploading(null);
    }
  };

  const commitViewClip = async (axis: FrameViewAxis) => {
    const mask = draftRef.current[axis];
    const view = getView(axis);
    if (!view.plateUrl || !mask || !isMaskConfigValid(mask)) {
      alert("Complete the lens clip path (3+ points on at least one lens) before saving.");
      return;
    }

    const clipConfig = maskConfigToLensClipConfig(mask);
    patchView(axis, {
      maskConfig: mask,
      maskStatus: "ready",
      clipConfig,
      clipStatus: "ready",
    });

    if (frameId && isApiFrameId(frameId)) {
      try {
        await renderingApi.upsertView(frameId, axis, {
          plateUrl: view.plateUrl.trim(),
          imageWidth: Math.max(1, Math.floor(view.width)),
          imageHeight: Math.max(1, Math.floor(view.height)),
          clipConfig,
          clipStatus: "ready",
          maskConfig: mask,
          maskStatus: "ready",
        });
      } catch (err) {
        console.warn("API clip sync failed (saved in form state)", err);
      }
    }
  };

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Render views</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload front and side (45°) photos, then draw lens SVG clip areas. Use{" "}
          <strong>Save clip</strong> when each view is complete — paths are stored for dynamic tint rendering.
        </p>
      </div>

      {FRAME_VIEW_AXES.map((axis) => {
        const view = getView(axis);
        const isEditing = editingView === axis;
        const hasPlate = Boolean(view.plateUrl);
        const clipReady = view.clipStatus === "ready" && Boolean(view.clipConfig);

        return (
          <div key={axis} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{FRAME_VIEW_LABELS[axis]}</p>
                {hasPlate ? (
                  <p className="text-xs text-muted-foreground">
                    {view.width}×{view.height} ·{" "}
                    <span className={clipReady ? "text-emerald-600" : "text-amber-600"}>
                      {clipReady ? "SVG clip ready" : "Clip in progress"}
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
                      onClick={() => {
                        if (isEditing) {
                          const mask = draftRef.current[axis];
                          if (mask && isMaskConfigValid(mask)) {
                            const clip = maskConfigToLensClipConfig(mask);
                            const cur = getView(axis);
                            const clipReady = Boolean(clip && isLensClipConfigValid(clip));
                            patchView(axis, {
                              maskConfig: {
                                ...mask,
                                updatedAt: cur.maskConfig?.updatedAt ?? mask.updatedAt,
                              },
                              maskStatus: clipReady ? "ready" : "draft",
                              clipConfig: clip
                                ? {
                                    ...clip,
                                    updatedAt: cur.clipConfig?.updatedAt ?? clip.updatedAt,
                                  }
                                : null,
                              clipStatus: clipReady ? "ready" : "draft",
                            });
                          }
                        } else {
                          const restored = resolveMaskConfigForEditor(view);
                          if (restored) draftRef.current[axis] = restored;
                          setEditSession((s) => ({ ...s, [axis]: (s[axis] ?? 0) + 1 }));
                        }
                        setEditingView(isEditing ? null : axis);
                      }}
                    >
                      {isEditing ? "Hide clip editor" : "Edit clip"}
                    </Button>
                    {isEditing ? (
                      <Button type="button" size="sm" onClick={() => void commitViewClip(axis)}>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Save clip
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {hasPlate && isEditing ? (
              <Suspense fallback={<LoadingState label="Loading clip editor…" className="h-48" />}>
                <FrameMaskEditor
                  key={`${editorPlateKey(view)}|s${editSession[axis] ?? 0}`}
                  plateUrl={view.plateUrl}
                  width={view.width}
                  height={view.height}
                  initialMask={draftRef.current[axis] ?? resolveMaskConfigForEditor(view)}
                  onChange={(config) => handleEditorChange(axis, config)}
                />
              </Suspense>
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
