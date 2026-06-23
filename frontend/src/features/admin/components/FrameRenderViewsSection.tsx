import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { FramePlateCropEditorHandle } from "./FramePlateCropEditor";
import { Frame, Loader2, Pencil, RotateCcw, Scan, UploadCloud, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { flushFrameRenderViews } from "@/features/admin/lib/frame-render-flush";
import { isApiError, uploadApi } from "@/services/api";
import type { FrameRenderView, FrameViewAxis } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES, FRAME_VIEW_LABELS } from "@/types/frame-rendering";
import { editorPlateKey, maskConfigToLensClipConfig, resolveMaskConfigForEditor } from "@/render/lens-clip";
import { loadImage, loadImageForProcessing } from "@/render/bead-crop/image-loader";
import { isBeadCropConfigValid, type BeadCropConfig } from "@bino-foundry/shared/types";
import {
  detectPlateCropConfig,
  effectivePlateDimensions,
  exportCroppedPlateBlob,
  hasPlateCropApplied,
  resolveOriginalPlate,
} from "@/render/frame-plate/crop";
import {
  detectFrameLensSideFromSource,
  hasAnyLensMask,
  isDualLensMaskValid,
  isLensSideValid,
  isMaskConfigValid,
  LENS_SIDE_LABELS,
  mergeLensSideIntoMask,
  type FrameLensSide,
  type MaskConfig,
} from "@/render/mask";
import { isLensClipConfigValid } from "@bino-foundry/shared/types";

import { LoadingState } from "@/components/common";
import { FramePlateCropEditor } from "./FramePlateCropEditor";
import { InlineEditorPanel, INLINE_SECTION_ACTIVE_CLASS } from "./InlineEditorPanel";

const FrameMaskEditor = lazy(() =>
  import("./FrameMaskEditor").then((m) => ({ default: m.FrameMaskEditor })),
);

type BusyAction =
  | { axis: FrameViewAxis; kind: "frame-auto" }
  | { axis: FrameViewAxis; kind: "detect-left" }
  | { axis: FrameViewAxis; kind: "detect-right" };

type ExpandedPanel = "frame" | "left" | "right";
type ExpandedEditor = { axis: FrameViewAxis; panel: ExpandedPanel };

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

function lensStatusLine(mask: MaskConfig | null): string {
  if (!mask) return "left lens pending · right lens pending";
  const left = isLensSideValid(mask, "left") ? "ready" : "pending";
  const right = isLensSideValid(mask, "right") ? "ready" : "pending";
  return `left lens ${left} · right lens ${right}`;
}

interface FrameRenderViewsSectionProps {
  views: FrameRenderView[];
  onChange: (views: FrameRenderView[]) => void;
}

export type FrameRenderViewsSectionHandle = {
  /** Commit open editor drafts into render views (does not close editors). */
  flushPendingEdits: () => FrameRenderView[];
};

/**
 * Front + side plates with inline expandable editors (accordion — one open at a time).
 */
export const FrameRenderViewsSection = forwardRef<
  FrameRenderViewsSectionHandle,
  FrameRenderViewsSectionProps
>(function FrameRenderViewsSection({ views, onChange }, ref) {
  const [uploading, setUploading] = useState<FrameViewAxis | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<ExpandedEditor | null>(null);
  const [editSession, setEditSession] = useState<Partial<Record<string, number>>>({});
  const [notice, setNotice] = useState<Partial<Record<FrameViewAxis, string>>>({});
  const [noticeVariant, setNoticeVariant] = useState<Partial<Record<FrameViewAxis, "success" | "warning">>>({});
  const [previewMasks, setPreviewMasks] = useState<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const draftRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const lensSnapshotRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const draftPlateUrlsRef = useRef<Partial<Record<FrameViewAxis, string>>>({});
  const frameCropEditorRef = useRef<FramePlateCropEditorHandle>(null);
  const [framePathReady, setFramePathReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      flushPendingEdits: () => {
        const cropByAxis: Partial<Record<FrameViewAxis, BeadCropConfig | null>> = {};
        if (expandedEditor?.panel === "frame") {
          const config = frameCropEditorRef.current?.commitDraft();
          if (config) cropByAxis[expandedEditor.axis] = config;
        }

        const flushed = flushFrameRenderViews(views, {
          cropByAxis,
          maskByAxis: { ...draftRef.current },
        });
        onChange(flushed);
        return flushed;
      },
    }),
    [expandedEditor, onChange, views],
  );

  const revokeDraftPlateUrl = useCallback((axis: FrameViewAxis) => {
    const url = draftPlateUrlsRef.current[axis];
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    delete draftPlateUrlsRef.current[axis];
  }, []);

  useEffect(() => {
    const urls = draftPlateUrlsRef.current;
    return () => {
      for (const axis of FRAME_VIEW_AXES) {
        const url = urls[axis];
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      }
    };
  }, []);

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

  const setAxisNotice = (axis: FrameViewAxis, message: string, variant: "success" | "warning" = "warning") => {
    setNotice((prev) => ({ ...prev, [axis]: message }));
    setNoticeVariant((prev) => ({ ...prev, [axis]: variant }));
  };

  const clearLensState = (): Partial<FrameRenderView> => ({
    maskConfig: null,
    maskStatus: "draft",
    clipConfig: null,
    clipStatus: "draft",
  });

  const commitMaskToView = (axis: FrameViewAxis, mask: MaskConfig | null) => {
    if (!mask || !isMaskConfigValid(mask)) return false;
    const clipConfig = maskConfigToLensClipConfig(mask);
    const clipReadyNow = Boolean(clipConfig && isLensClipConfigValid(clipConfig));
    draftRef.current[axis] = mask;
    setPreviewMasks((prev) => ({ ...prev, [axis]: mask }));
    patchView(axis, {
      maskConfig: mask,
      maskStatus: isDualLensMaskValid(mask) ? "ready" : "draft",
      clipConfig,
      clipStatus: clipReadyNow && isDualLensMaskValid(mask) ? "ready" : "draft",
    });
    return true;
  };

  const getWorkingPlate = useCallback(
    async (axis: FrameViewAxis): Promise<{ url: string; width: number; height: number }> => {
      const view = getView(axis);
      const original = resolveOriginalPlate(view);
      if (!original.url) return { url: "", width: 0, height: 0 };

      const committedCrop =
        view.plateUrl.trim() !== original.url.trim() && !hasPlateCropApplied(view);
      if (committedCrop) {
        return { url: view.plateUrl, width: view.width, height: view.height };
      }

      const cropConfig = view.plateCropConfig;
      if (cropConfig && isBeadCropConfigValid(cropConfig)) {
        revokeDraftPlateUrl(axis);
        const exported = await exportCroppedPlateBlob(cropConfig);
        const blobUrl = URL.createObjectURL(exported.blob);
        draftPlateUrlsRef.current[axis] = blobUrl;
        return { url: blobUrl, width: exported.width, height: exported.height };
      }

      const dims = effectivePlateDimensions(view);
      return { url: original.url, width: dims.width, height: dims.height };
    },
    [getView, revokeDraftPlateUrl],
  );

  const isBusy = (axis: FrameViewAxis, kind?: BusyAction["kind"]) => {
    if (uploading === axis) return true;
    if (!busyAction || busyAction.axis !== axis) return false;
    return !kind || busyAction.kind === kind;
  };

  const closeEditor = () => {
    setExpandedEditor(null);
    setFramePathReady(false);
  };

  const cancelEditor = (axis: FrameViewAxis) => {
    if (expandedEditor?.panel === "left" || expandedEditor?.panel === "right") {
      const snapshot = lensSnapshotRef.current[axis] ?? null;
      draftRef.current[axis] = snapshot;
      if (snapshot && hasAnyLensMask(snapshot)) {
        setPreviewMasks((prev) => ({ ...prev, [axis]: snapshot }));
      } else {
        const view = getView(axis);
        const resolved = resolveMaskConfigForEditor(view);
        setPreviewMasks((prev) => ({
          ...prev,
          [axis]: resolved && hasAnyLensMask(resolved) ? resolved : null,
        }));
      }
    }
    closeEditor();
  };

  const openEditor = (axis: FrameViewAxis, panel: ExpandedPanel) => {
    setFramePathReady(false);
    if (panel === "left" || panel === "right") {
      const view = getView(axis);
      const restored =
        previewMasks[axis] ??
        draftRef.current[axis] ??
        resolveMaskConfigForEditor(view);
      lensSnapshotRef.current[axis] = restored ? structuredClone(restored) : null;
      if (restored) {
        draftRef.current[axis] = restored;
        if (hasAnyLensMask(restored)) {
          setPreviewMasks((prev) => ({ ...prev, [axis]: restored }));
        }
      }
      const sessionKey = `${axis}-${panel}`;
      setEditSession((s) => ({ ...s, [sessionKey]: (s[sessionKey] ?? 0) + 1 }));
    }
    setExpandedEditor({ axis, panel });
    if (panel === "frame") {
      const view = getView(axis);
      setFramePathReady(Boolean(view.plateCropConfig && isBeadCropConfigValid(view.plateCropConfig)));
    }
  };

  const resolvePreviewMask = (axis: FrameViewAxis, view: FrameRenderView): MaskConfig | null => {
    const preview = previewMasks[axis];
    if (preview && hasAnyLensMask(preview)) return preview;
    const draft = draftRef.current[axis];
    if (draft && hasAnyLensMask(draft)) return draft;
    const resolved = resolveMaskConfigForEditor(view);
    if (resolved && hasAnyLensMask(resolved)) return resolved;
    return null;
  };

  const handleUpload = async (axis: FrameViewAxis, file: File) => {
    setUploading(axis);
    setNotice((prev) => ({ ...prev, [axis]: undefined }));
    if (expandedEditor?.axis === axis) closeEditor();
    revokeDraftPlateUrl(axis);
    draftRef.current[axis] = null;
    setPreviewMasks((prev) => ({ ...prev, [axis]: null }));

    try {
      const { imageUrl } = await uploadApi.uploadImage(file);
      const img = await loadImage(imageUrl);
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      patchView(axis, {
        plateUrl: imageUrl,
        width,
        height,
        originalPlateUrl: imageUrl,
        originalWidth: width,
        originalHeight: height,
        plateCropConfig: null,
        ...clearLensState(),
      });
      setAxisNotice(
        axis,
        "Original saved. Adjust the frame or define lens areas — changes apply on Save frame.",
        "success",
      );
    } catch (err) {
      alert(isApiError(err) ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleAutoCropInEditor = async (axis: FrameViewAxis) => {
    const original = resolveOriginalPlate(getView(axis));
    if (!original.url) return;

    setBusyAction({ axis, kind: "frame-auto" });
    try {
      const result = await detectPlateCropConfig(original.url);
      if (!result.config) {
        setAxisNotice(axis, result.message ?? "No frame outline detected.", "warning");
        return;
      }
      frameCropEditorRef.current?.applyDraft(result.config);
      setFramePathReady(true);
      setAxisNotice(
        axis,
        result.message ?? "Frame boundary detected — save changes to apply.",
        result.trimmed ? "success" : "warning",
      );
    } catch (err) {
      setAxisNotice(axis, err instanceof Error ? err.message : "Auto crop frame failed", "warning");
    } finally {
      setBusyAction(null);
    }
  };

  const resetFrameInEditor = (axis: FrameViewAxis) => {
    frameCropEditorRef.current?.resetDraft();
    setFramePathReady(false);
    setAxisNotice(axis, "Frame crop path cleared in editor.", "success");
  };

  const resetLensSideInEditor = (axis: FrameViewAxis, side: FrameLensSide) => {
    const view = getView(axis);
    const dims = effectivePlateDimensions(view);
    const existing = draftRef.current[axis] ?? resolveMaskConfigForEditor(view) ?? null;
    const cleared = mergeLensSideIntoMask(existing, dims.width, dims.height, side, []);
    draftRef.current[axis] = cleared;
    setPreviewMasks((prev) => ({ ...prev, [axis]: hasAnyLensMask(cleared) ? cleared : null }));
    const sessionKey = `${axis}-${side}`;
    setEditSession((s) => ({ ...s, [sessionKey]: (s[sessionKey] ?? 0) + 1 }));
    setAxisNotice(axis, `${LENS_SIDE_LABELS[side]} path cleared in editor.`, "success");
  };

  const handleFramePathSave = (axis: FrameViewAxis, config: BeadCropConfig) => {
    revokeDraftPlateUrl(axis);

    const next = flushFrameRenderViews(views, { cropByAxis: { [axis]: config } });
    onChange(next);
    closeEditor();
    setAxisNotice(axis, "Frame clip path saved to draft.", "success");
  };

  const handleDetectLensSide = async (axis: FrameViewAxis, side: FrameLensSide) => {
    const view = getView(axis);
    const original = resolveOriginalPlate(view);
    if (!original.url) {
      setAxisNotice(axis, "Upload a plate photo before running lens detection.", "warning");
      return;
    }

    setBusyAction({ axis, kind: side === "left" ? "detect-left" : "detect-right" });
    setAxisNotice(axis, `Detecting ${LENS_SIDE_LABELS[side].toLowerCase()}…`, "warning");

    try {
      const plate = await getWorkingPlate(axis);
      if (!plate.url) {
        setAxisNotice(axis, "No plate image available for detection.", "warning");
        return;
      }

      if (import.meta.env.DEV) {
        console.info(`[lens-detect:${side}] plate`, {
          url: plate.url.slice(0, 80),
          width: plate.width,
          height: plate.height,
        });
      }

      const img = await loadImageForProcessing(plate.url);
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      if (imgW <= 0 || imgH <= 0) {
        setAxisNotice(axis, "Could not read plate image dimensions for lens detection.", "warning");
        return;
      }

      if (import.meta.env.DEV) {
        console.info(`[lens-detect:${side}] image loaded`, { imgW, imgH });
      }

      const existing =
        draftRef.current[axis] ?? resolveMaskConfigForEditor(view) ?? null;

      const detection = detectFrameLensSideFromSource(img, side);

      if (import.meta.env.DEV) {
        console.info(`[lens-detect:${side}] result`, {
          detected: detection.detected,
          pointCount: detection.diagnostics?.pointCount,
          regions: detection.diagnostics?.regionCount,
          source: detection.diagnostics?.imageSource,
        });
      }

      if (detection.detected && detection.anchors) {
        const mask = mergeLensSideIntoMask(
          existing,
          imgW,
          imgH,
          side,
          detection.anchors,
        );
        draftRef.current[axis] = mask;
        setPreviewMasks((prev) => ({ ...prev, [axis]: mask }));

        const sessionKey = `${axis}-${side}`;
        const editorOpen =
          expandedEditor?.axis === axis && expandedEditor.panel === side;

        if (!editorOpen) {
          openEditor(axis, side);
        } else {
          setEditSession((s) => ({ ...s, [sessionKey]: (s[sessionKey] ?? 0) + 1 }));
        }

        const diag = detection.diagnostics
          ? ` (${detection.diagnostics.pointCount} points, ${detection.diagnostics.imageSource})`
          : "";
        setAxisNotice(
          axis,
          `${LENS_SIDE_LABELS[side]} detected${diag} — review the overlay, then save changes.`,
          "success",
        );
      } else {
        const diag = detection.diagnostics
          ? ` ${detection.diagnostics.imageWidth}×${detection.diagnostics.imageHeight}px, ${detection.diagnostics.regionCount} region(s) found.`
          : "";
        setAxisNotice(
          axis,
          `${detection.message ?? `Could not detect ${LENS_SIDE_LABELS[side].toLowerCase()}.`}${diag}`,
          "warning",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lens contour detection failed.";
      if (import.meta.env.DEV) {
        console.error(`[lens-detect:${side}] failed`, err);
      }
      setAxisNotice(axis, message, "warning");
    } finally {
      setBusyAction(null);
    }
  };

  const handleEditorChange = useCallback((axis: FrameViewAxis, mask: MaskConfig | null) => {
    draftRef.current[axis] = mask;
    if (mask && hasAnyLensMask(mask)) {
      setPreviewMasks((prev) => ({ ...prev, [axis]: mask }));
    }
  }, []);

  const saveLensEditor = (axis: FrameViewAxis, side: FrameLensSide) => {
    const mask = draftRef.current[axis];
    if (!mask || !isLensSideValid(mask, side)) {
      alert(`Draw a closed path for the ${LENS_SIDE_LABELS[side].toLowerCase()} (≥3 points) before saving.`);
      return;
    }
    if (commitMaskToView(axis, mask)) {
      closeEditor();
      setAxisNotice(axis, `${LENS_SIDE_LABELS[side]} saved to draft.`, "success");
    }
  };

  return (
    <div className="space-y-8 border-t border-border pt-4">
      <div>
        <h3 className="type-h3 text-base">Render views</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload front and side photos, then open an editor to draw clip paths and lens masks. Only one
          editor expands at a time. Click Save frame to persist all changes.
        </p>
      </div>

      {FRAME_VIEW_AXES.map((axis) => {
        const view = getView(axis);
        const hasPlate = Boolean(resolveOriginalPlate(view).url);
        const original = resolveOriginalPlate(view);
        const framePathSet = hasPlateCropApplied(view);
        const committedCrop =
          Boolean(original.url) &&
          Boolean(view.plateUrl) &&
          view.plateUrl.trim() !== original.url.trim() &&
          !framePathSet;
        const overlayMask = resolvePreviewMask(axis, view);
        const working = isBusy(axis);
        const noticeTone = noticeVariant[axis] === "success" ? "text-status-success" : "text-status-warning";
        const isFramePanelOpen = expandedEditor?.axis === axis && expandedEditor.panel === "frame";
        const isLeftPanelOpen = expandedEditor?.axis === axis && expandedEditor.panel === "left";
        const isRightPanelOpen = expandedEditor?.axis === axis && expandedEditor.panel === "right";

        return (
          <section key={axis} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">{FRAME_VIEW_LABELS[axis]}</h4>
              {hasPlate ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {effectivePlateDimensions(view).width}×{effectivePlateDimensions(view).height}
                  {framePathSet ? " · frame path set" : committedCrop ? " · processed frame" : " · full original"}
                  {" · "}
                  {lensStatusLine(overlayMask)}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">No plate uploaded</p>
              )}
              {notice[axis] ? <p className={`mt-1 text-xs ${noticeTone}`}>{notice[axis]}</p> : null}
            </div>

            <div className="mb-4">
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={working}
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
            </div>

            {hasPlate ? (
              <div className="space-y-4">
                <div
                  className={cn(
                    isFramePanelOpen && INLINE_SECTION_ACTIVE_CLASS,
                    !isFramePanelOpen && "px-0.5",
                  )}
                >
                  <p className="type-label mb-2 text-muted-foreground">Frame</p>
                  {!isFramePanelOpen ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={working}
                      onClick={() => openEditor(axis, "frame")}
                    >
                      <Frame className="mr-1.5 h-3.5 w-3.5" />
                      Edit Frame
                    </Button>
                  ) : null}

                  {isFramePanelOpen ? (
                    <InlineEditorPanel
                      title="Frame clip editor"
                      description="Draw the visible frame boundary on the photo. The editing canvas is your working view."
                      toolbar={
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy(axis, "frame-auto")}
                            onClick={() => void handleAutoCropInEditor(axis)}
                          >
                            {isBusy(axis, "frame-auto") ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Auto Crop Frame
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => resetFrameInEditor(axis)}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset Frame
                          </Button>
                        </>
                      }
                      saveDisabled={!framePathReady}
                      onSave={() => {
                        const config = frameCropEditorRef.current?.commitDraft();
                        if (!config) {
                          alert("Draw a closed frame path (≥3 points) before saving.");
                          return;
                        }
                        handleFramePathSave(axis, config);
                      }}
                      onCancel={() => cancelEditor(axis)}
                    >
                      <FramePlateCropEditor
                        ref={frameCropEditorRef}
                        inline
                        originalUrl={original.url}
                        imageWidth={original.width}
                        imageHeight={original.height}
                        initialCrop={view.plateCropConfig}
                        onDraftChange={(_config, valid) => setFramePathReady(valid)}
                      />
                    </InlineEditorPanel>
                  ) : null}
                </div>

                <p className="type-label text-muted-foreground">Lens area</p>

                <div
                  className={cn(
                    isLeftPanelOpen && INLINE_SECTION_ACTIVE_CLASS,
                    !isLeftPanelOpen && "px-0.5",
                  )}
                >
                  <p className="mb-2 text-xs font-medium text-foreground">Left lens</p>
                  {!isLeftPanelOpen ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={working}
                        onClick={() => openEditor(axis, "left")}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit Left Lens
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy(axis, "detect-left")}
                        onClick={() => void handleDetectLensSide(axis, "left")}
                      >
                        {isBusy(axis, "detect-left") ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Scan className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Auto Detect Left Lens
                      </Button>
                    </div>
                  ) : null}

                  {isLeftPanelOpen ? (
                    <InlineEditorPanel
                      title="Left lens path editor"
                      description="You are editing the left lens mask. Draw a closed path on the plate."
                      toolbar={
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy(axis, "detect-left")}
                            onClick={() => void handleDetectLensSide(axis, "left")}
                          >
                            {isBusy(axis, "detect-left") ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Scan className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Auto Detect Left Lens
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => resetLensSideInEditor(axis, "left")}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset Left Lens
                          </Button>
                        </>
                      }
                      onSave={() => saveLensEditor(axis, "left")}
                      onCancel={() => cancelEditor(axis)}
                    >
                      <Suspense fallback={<LoadingState label="Loading editor…" className="h-40" />}>
                        <LensEditorForView
                          axis={axis}
                          side="left"
                          view={view}
                          editSession={editSession[`${axis}-left`] ?? 0}
                          getWorkingPlate={getWorkingPlate}
                          initialMask={
                            previewMasks[axis] ??
                            draftRef.current[axis] ??
                            resolveMaskConfigForEditor(view)
                          }
                          onChange={(config) => handleEditorChange(axis, config)}
                        />
                      </Suspense>
                    </InlineEditorPanel>
                  ) : null}
                </div>

                <div
                  className={cn(
                    isRightPanelOpen && INLINE_SECTION_ACTIVE_CLASS,
                    !isRightPanelOpen && "px-0.5",
                  )}
                >
                  <p className="mb-2 text-xs font-medium text-foreground">Right lens</p>
                  {!isRightPanelOpen ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={working}
                        onClick={() => openEditor(axis, "right")}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit Right Lens
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy(axis, "detect-right")}
                        onClick={() => void handleDetectLensSide(axis, "right")}
                      >
                        {isBusy(axis, "detect-right") ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Scan className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Auto Detect Right Lens
                      </Button>
                    </div>
                  ) : null}

                  {isRightPanelOpen ? (
                    <InlineEditorPanel
                      title="Right lens path editor"
                      description="You are editing the right lens mask. Draw a closed path on the plate."
                      toolbar={
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy(axis, "detect-right")}
                            onClick={() => void handleDetectLensSide(axis, "right")}
                          >
                            {isBusy(axis, "detect-right") ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Scan className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Auto Detect Right Lens
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => resetLensSideInEditor(axis, "right")}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset Right Lens
                          </Button>
                        </>
                      }
                      onSave={() => saveLensEditor(axis, "right")}
                      onCancel={() => cancelEditor(axis)}
                    >
                      <Suspense fallback={<LoadingState label="Loading editor…" className="h-40" />}>
                        <LensEditorForView
                          axis={axis}
                          side="right"
                          view={view}
                          editSession={editSession[`${axis}-right`] ?? 0}
                          getWorkingPlate={getWorkingPlate}
                          initialMask={
                            previewMasks[axis] ??
                            draftRef.current[axis] ??
                            resolveMaskConfigForEditor(view)
                          }
                          onChange={(config) => handleEditorChange(axis, config)}
                        />
                      </Suspense>
                    </InlineEditorPanel>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
});

function LensEditorForView({
  axis,
  side,
  view,
  editSession,
  getWorkingPlate,
  initialMask,
  onChange,
  onPlateError,
}: {
  axis: FrameViewAxis;
  side: FrameLensSide;
  view: FrameRenderView;
  editSession: number;
  getWorkingPlate: (axis: FrameViewAxis) => Promise<{ url: string; width: number; height: number }>;
  initialMask?: MaskConfig | null;
  onChange: (config: MaskConfig | null) => void;
  onPlateError?: (message: string) => void;
}) {
  const [plate, setPlate] = useState<{ url: string; width: number; height: number } | null>(null);
  const [plateError, setPlateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPlateError(null);
    void getWorkingPlate(axis)
      .then((result) => {
        if (cancelled) return;
        if (!result.url) {
          const message = "No plate image available for the lens editor.";
          setPlateError(message);
          onPlateError?.(message);
          setPlate(null);
          return;
        }
        setPlate(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not prepare plate for lens editing.";
        setPlateError(message);
        onPlateError?.(message);
        setPlate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [axis, getWorkingPlate, onPlateError, view.plateUrl, view.plateCropConfig, editSession]);

  if (plateError) {
    return <p className="text-xs text-status-warning">{plateError}</p>;
  }

  if (!plate?.url) {
    return <LoadingState label="Preparing plate…" className="h-40" />;
  }

  return (
    <FrameMaskEditor
      key={`${editorPlateKey(view)}|${side}`}
      plateUrl={plate.url}
      width={plate.width}
      height={plate.height}
      focusedLensId={side}
      initialMask={initialMask}
      lensRevision={editSession}
      onChange={onChange}
    />
  );
}
