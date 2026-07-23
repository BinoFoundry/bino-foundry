import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { FramePlateCropEditorHandle } from "./FramePlateCropEditor";
import { Check, Frame, Loader2, Pencil, RotateCcw, Scan, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { flushFrameRenderViews } from "@/features/admin/lib/frame-render-flush";
import { isApiError, uploadApi } from "@/services/api";
import type { FrameRenderView, FrameViewAxis } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES, FRAME_VIEW_LABELS } from "@/types/frame-rendering";
import {
  editorPlateKey,
  maskConfigToLensClipConfig,
  resolveMaskConfigForEditor,
} from "@/render/lens-clip";
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
  detectFrameLensMaskFromSource,
  detectFrameLensSideFromSource,
  hasAnyLensMask,
  isDualLensMaskValid,
  isLensSideValid,
  isMaskConfigValid,
  LENS_SIDE_LABELS,
  mergeLensSideIntoMask,
  resolveMaskFrameExclusions,
  type FrameLensSide,
  type MaskConfig,
} from "@/render/mask";
import { isLensClipConfigValid } from "@bino-foundry/shared/types";
import type { LensClipRenderSettings, LensRenderingPreset } from "@bino-foundry/shared/types";

import { LoadingState } from "@/components/common";
import { FramePlateCropEditor } from "./FramePlateCropEditor";
import { InlineEditorPanel, INLINE_SECTION_ACTIVE_CLASS } from "./InlineEditorPanel";
import { LensRenderingSettingsPanel } from "./LensRenderingSettingsPanel";
import type { LensEditorMode } from "./FrameMaskEditor";
import {
  buildSparseFrameRenderOverride,
  resolveAssignedLensRenderPreset,
  resolveFrameLensRenderSettings,
} from "@/render/lens-clip/lens-render-hierarchy";

const FrameMaskEditor = lazy(() =>
  import("./FrameMaskEditor").then((m) => ({ default: m.FrameMaskEditor })),
);

type BusyAction =
  | { axis: FrameViewAxis; kind: "frame-auto" }
  | { axis: FrameViewAxis; kind: "detect-left" }
  | { axis: FrameViewAxis; kind: "detect-right" }
  | { axis: FrameViewAxis; kind: "detect-both" };

type ExpandedPanel = "frame" | "left" | "right" | "exclusions";

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

/** Views whose lens clip is complete enough to accept render settings. */
function viewsWithValidClip(views: FrameRenderView[]): FrameRenderView[] {
  return FRAME_VIEW_AXES.map(
    (axis) => views.find((v) => v.view === axis) ?? emptyView(axis),
  ).filter((v) => v.clipConfig && isLensClipConfigValid(v.clipConfig));
}

type LensRenderingScope = NonNullable<LensClipRenderSettings["renderScope"]>;

function resolveRenderingScope(views: FrameRenderView[]): LensRenderingScope {
  for (const view of viewsWithValidClip(views)) {
    const scope = view.clipConfig?.render?.renderScope;
    if (scope) return scope;
  }
  return "global";
}

/** Remove only admin opacity overrides so an out-of-scope view resolves renderer defaults. */
function withDefaultOpacitySettings(
  render: LensClipRenderSettings | undefined,
  renderScope: LensRenderingScope,
): LensClipRenderSettings {
  const next = { ...render, renderScope };
  delete next.tintLayerOpacity;
  delete next.tintFilterOpacity;
  delete next.lensOpacity;
  delete next.baseTintOpacity;
  delete next.transparency;
  delete next.reflectionOpacity;
  delete next.highlightStrength;
  delete next.edgeDarkness;
  return next;
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
  lensRenderPresetId?: string | null;
  useLensRenderPreset?: boolean;
  lensRenderPresets?: LensRenderingPreset[];
  lensRenderSystemDefaults?: LensClipRenderSettings | null;
  onLensRenderAssignmentChange?: (next: {
    lensRenderPresetId: string | null;
    useLensRenderPreset: boolean;
  }) => void;
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
>(function FrameRenderViewsSection(
  {
    views,
    onChange,
    lensRenderPresetId = null,
    useLensRenderPreset = true,
    lensRenderPresets = [],
    lensRenderSystemDefaults,
    onLensRenderAssignmentChange,
  },
  ref,
) {
  const [uploading, setUploading] = useState<FrameViewAxis | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<ExpandedEditor | null>(null);
  const [editSession, setEditSession] = useState<Partial<Record<string, number>>>({});
  const [notice, setNotice] = useState<Partial<Record<FrameViewAxis, string>>>({});
  const [noticeVariant, setNoticeVariant] = useState<Partial<Record<FrameViewAxis, "success" | "warning">>>({});
  const [exclusionSaved, setExclusionSaved] =
    useState<Partial<Record<FrameViewAxis, boolean>>>({});
  const [previewMasks, setPreviewMasks] = useState<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const draftRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const lensSnapshotRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const draftPlateUrlsRef = useRef<Partial<Record<FrameViewAxis, string>>>({});
  const exclusionSavedTimersRef =
    useRef<Partial<Record<FrameViewAxis, ReturnType<typeof setTimeout>>>>({});
  const frameCropEditorRef = useRef<FramePlateCropEditorHandle>(null);
  const [framePathReady, setFramePathReady] = useState(false);
  const [renderingScope, setRenderingScope] = useState<LensRenderingScope>(() =>
    resolveRenderingScope(views),
  );

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

  // Latest views for stable callbacks — reading through the ref keeps getWorkingPlate
  // identity constant so the lens editor's plate effect does not re-run (and recreate
  // the canvas) on every draft patch, which previously caused an infinite refresh loop.
  const viewsRef = useRef(views);
  viewsRef.current = views;

  const revokeDraftPlateUrl = useCallback((axis: FrameViewAxis) => {
    const url = draftPlateUrlsRef.current[axis];
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    delete draftPlateUrlsRef.current[axis];
  }, []);

  useEffect(() => {
    const urls = draftPlateUrlsRef.current;
    const feedbackTimers = exclusionSavedTimersRef.current;
    return () => {
      for (const axis of FRAME_VIEW_AXES) {
        const url = urls[axis];
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        const timer = feedbackTimers[axis];
        if (timer) clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    for (const axis of FRAME_VIEW_AXES) {
      const view = views.find((v) => v.view === axis);
      if (!view) continue;
      if (draftRef.current[axis] && hasAnyLensMask(draftRef.current[axis]!)) continue;
      const resolved = resolveMaskConfigForEditor(view);
      if (resolved && hasAnyLensMask(resolved)) {
        draftRef.current[axis] = resolved;
        setPreviewMasks((prev) => (prev[axis] ? prev : { ...prev, [axis]: resolved }));
      }
    }
  }, [views]);

  useEffect(() => {
    setRenderingScope(resolveRenderingScope(views));
  }, [views]);

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
    const existing = getView(axis).clipConfig;
    const clipConfig = maskConfigToLensClipConfig(mask, {
      render: existing?.render,
      existingClip: existing,
    });
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

  const patchClipRender = (axis: FrameViewAxis, render: LensClipRenderSettings) => {
    const view = getView(axis);
    const clip = view.clipConfig;
    if (!clip || !isLensClipConfigValid(clip)) {
      toast.error("Configure left and right lens clips before adjusting lens rendering.");
      return;
    }
    patchView(axis, {
      clipConfig: { ...clip, render, updatedAt: Date.now() },
    });
  };

  const applyRenderingScope = (
    scope: LensRenderingScope,
    customRender?: LensClipRenderSettings,
  ) => {
    const now = Date.now();
    const next = FRAME_VIEW_AXES.map((v) => {
      const current = views.find((x) => x.view === v) ?? emptyView(v);
      if (current.clipConfig && isLensClipConfigValid(current.clipConfig)) {
        const isCustomView = scope === "global" || v === scope;
        const render = isCustomView
          ? { ...(customRender ?? current.clipConfig.render), renderScope: scope }
          : withDefaultOpacitySettings(current.clipConfig.render, scope);
        return {
          ...current,
          clipConfig: { ...current.clipConfig, render, updatedAt: now },
          view: v,
        };
      }
      return current;
    });
    onChange(next);
  };

  const handleRenderChange = (axis: FrameViewAxis, render: LensClipRenderSettings) => {
    const scopedRender = { ...render, renderScope: renderingScope };
    if (renderingScope === "global") {
      applyRenderingScope("global", scopedRender);
    } else {
      patchClipRender(axis, scopedRender);
    }
  };

  const changeRenderingScope = (scope: LensRenderingScope) => {
    setRenderingScope(scope);
    const clipViews = viewsWithValidClip(views);
    const sourceAxis = scope === "side" ? "side" : "front";
    const source =
      clipViews.find((view) => view.view === sourceAxis)?.clipConfig?.render ??
      clipViews[0]?.clipConfig?.render;
    applyRenderingScope(scope, source);
  };

  const getWorkingPlate = useCallback(
    async (axis: FrameViewAxis): Promise<{ url: string; width: number; height: number }> => {
      const view = viewsRef.current.find((v) => v.view === axis) ?? emptyView(axis);
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
    [revokeDraftPlateUrl],
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
    if (
      expandedEditor?.panel === "left" ||
      expandedEditor?.panel === "right" ||
      expandedEditor?.panel === "exclusions"
    ) {
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
    if (panel === "left" || panel === "right" || panel === "exclusions") {
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

      // Always apply best-effort dual polygons so the admin has editable points.
      try {
        const detection = detectFrameLensMaskFromSource(img);
        if (detection.config && isDualLensMaskValid(detection.config)) {
          commitMaskToView(axis, detection.config);
          openEditor(axis, "left");
          const conf = detection.confidence ?? 0;
          setAxisNotice(
            axis,
            detection.message ??
              (conf >= 0.7
                ? "Original saved and both lenses detected — review overlays, then Save frame."
                : "Original saved with starting lens polygons — adjust and save."),
            conf >= 0.7 ? "success" : "warning",
          );
        } else {
          setAxisNotice(
            axis,
            "Original saved. Use Auto Detect Both Lenses to add starting polygons.",
            "success",
          );
        }
      } catch {
        setAxisNotice(
          axis,
          "Original saved. Use Auto Detect Both Lenses to add starting polygons.",
          "success",
        );
      }
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Upload failed");
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

        const conf = detection.confidence ?? 0;
        const fallbackMsg =
          detection.message ??
          `${LENS_SIDE_LABELS[side]} ready — review the overlay, then save changes.`;
        setAxisNotice(axis, fallbackMsg, conf >= 0.7 ? "success" : "warning");
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

  const handleDetectBothLenses = async (axis: FrameViewAxis) => {
    const view = getView(axis);
    const original = resolveOriginalPlate(view);
    if (!original.url) {
      setAxisNotice(axis, "Upload a plate photo before running lens detection.", "warning");
      return;
    }

    setBusyAction({ axis, kind: "detect-both" });
    setAxisNotice(axis, "Detecting left and right lenses…", "warning");

    try {
      const plate = await getWorkingPlate(axis);
      if (!plate.url) {
        setAxisNotice(axis, "No plate image available for detection.", "warning");
        return;
      }
      const img = await loadImageForProcessing(plate.url);
      const detection = detectFrameLensMaskFromSource(img);

      if (detection.config && isDualLensMaskValid(detection.config)) {
        // Auto-detect rebuilds both openings; keep any frame exclusions already drawn.
        const preserved = resolveMaskFrameExclusions(
          previewMasks[axis] ?? draftRef.current[axis] ?? resolveMaskConfigForEditor(view),
        );
        const detected = preserved.length
          ? { ...detection.config, frameExclusions: preserved }
          : detection.config;
        commitMaskToView(axis, detected);
        openEditor(axis, "left");
        const conf = detection.confidence ?? 0;
        setAxisNotice(
          axis,
          detection.message ??
            (conf >= 0.7
              ? "Both lenses detected — review overlays, then Save frame."
              : "Starting lens polygons ready — review and adjust before saving."),
          conf >= 0.7 ? "success" : "warning",
        );
      } else if (detection.config && hasAnyLensMask(detection.config)) {
        draftRef.current[axis] = detection.config;
        setPreviewMasks((prev) => ({ ...prev, [axis]: detection.config }));
        setAxisNotice(
          axis,
          detection.message ?? "Partial lens polygons added — finish the missing side, then save.",
          "warning",
        );
      } else {
        setAxisNotice(
          axis,
          detection.message ?? "Could not build lens polygons. Draw them manually.",
          "warning",
        );
      }
    } catch (err) {
      setAxisNotice(axis, err instanceof Error ? err.message : "Lens detection failed.", "warning");
    } finally {
      setBusyAction(null);
    }
  };

  const handleEditorChange = useCallback(
    (axis: FrameViewAxis, mask: MaskConfig | null) => {
      draftRef.current[axis] = mask;
      if (mask && hasAnyLensMask(mask)) {
        setPreviewMasks((prev) => ({ ...prev, [axis]: mask }));
        if (isMaskConfigValid(mask)) {
          const existing = getView(axis).clipConfig;
          const clipConfig = maskConfigToLensClipConfig(mask, {
            render: existing?.render,
            existingClip: existing,
          });
          patchView(axis, {
            maskConfig: mask,
            maskStatus: isDualLensMaskValid(mask) ? "ready" : "draft",
            clipConfig,
            clipStatus:
              clipConfig && isLensClipConfigValid(clipConfig) && isDualLensMaskValid(mask)
                ? "ready"
                : "draft",
          });
        }
      }
    },
    [getView, patchView],
  );

  const saveLensEditor = (axis: FrameViewAxis, side: FrameLensSide) => {
    const mask = draftRef.current[axis];
    if (!mask || !isLensSideValid(mask, side)) {
      toast.error(`Draw a closed path for the ${LENS_SIDE_LABELS[side].toLowerCase()} (≥3 points) before saving.`);
      return;
    }
    if (commitMaskToView(axis, mask)) {
      closeEditor();
      setAxisNotice(axis, `${LENS_SIDE_LABELS[side]} saved to draft.`, "success");
    }
  };

  const saveExclusionsEditor = (axis: FrameViewAxis) => {
    const mask = draftRef.current[axis] ?? resolveMaskConfigForEditor(getView(axis));
    if (!mask || !isMaskConfigValid(mask)) {
      toast.error("Define the lens openings before saving frame exclusions.");
      return;
    }
    if (commitMaskToView(axis, mask)) {
      setAxisNotice(axis, "Frame objects saved to draft.", "success");
      const existingTimer = exclusionSavedTimersRef.current[axis];
      if (existingTimer) clearTimeout(existingTimer);
      setExclusionSaved((prev) => ({ ...prev, [axis]: true }));
      exclusionSavedTimersRef.current[axis] = setTimeout(() => {
        setExclusionSaved((prev) => ({ ...prev, [axis]: false }));
        delete exclusionSavedTimersRef.current[axis];
      }, 2200);
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
        const isExclusionsPanelOpen =
          expandedEditor?.axis === axis && expandedEditor.panel === "exclusions";

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
                <div className="flex flex-wrap gap-2 px-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy(axis, "detect-both")}
                    onClick={() => void handleDetectBothLenses(axis)}
                  >
                    {isBusy(axis, "detect-both") ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Auto Detect Both Lenses
                  </Button>
                </div>
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
                          toast.error("Draw a closed frame path (≥3 points) before saving.");
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
                      description="Edit the left lens opening polygon. Frame parts inside the lens are handled by the Frame objects editor."
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
                          editMode="polygon"
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
                      description="Edit the right lens opening polygon. Frame parts inside the lens are handled by the Frame objects editor."
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
                          editMode="polygon"
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

                <p className="type-label text-muted-foreground">Frame objects</p>

                <div
                  className={cn(
                    isExclusionsPanelOpen && INLINE_SECTION_ACTIVE_CLASS,
                    !isExclusionsPanelOpen && "px-0.5",
                  )}
                >
                  <p className="mb-2 text-xs text-muted-foreground">
                    Physical frame objects inside the lens openings (bridge support, screws, inner
                    rim, nylon wire). Each object can sit behind, inside, or in front of the glass.
                  </p>
                  {!isExclusionsPanelOpen ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={working}
                      onClick={() => openEditor(axis, "exclusions")}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit Frame Objects
                    </Button>
                  ) : null}

                  {isExclusionsPanelOpen ? (
                    <InlineEditorPanel
                      title="Frame objects editor"
                      description="Draw frame structures inside the lens openings and choose whether each sits behind, inside, or in front of the glass."
                      onSave={() => saveExclusionsEditor(axis)}
                      onCancel={() => cancelEditor(axis)}
                      saveFeedback={
                        exclusionSaved[axis] ? (
                          <>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Changes saved
                          </>
                        ) : null
                      }
                    >
                      <Suspense fallback={<LoadingState label="Loading editor…" className="h-40" />}>
                        <LensEditorForView
                          axis={axis}
                          side="left"
                          view={view}
                          editSession={editSession[`${axis}-exclusions`] ?? 0}
                          editMode="exclusions"
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

      <LensRenderingSection
        views={views}
        disabled={Boolean(busyAction) || uploading !== null}
        scope={renderingScope}
        onScopeChange={changeRenderingScope}
        onChange={handleRenderChange}
        lensRenderPresetId={lensRenderPresetId}
        useLensRenderPreset={useLensRenderPreset}
        lensRenderPresets={lensRenderPresets}
        lensRenderSystemDefaults={lensRenderSystemDefaults}
        onLensRenderAssignmentChange={onLensRenderAssignmentChange}
      />
    </div>
  );
});

/** Lens-rendering controls with explicit read-only preset and sparse frame-override modes. */
function LensRenderingSection({
  views,
  disabled,
  scope,
  onScopeChange,
  onChange,
  lensRenderPresetId,
  useLensRenderPreset,
  lensRenderPresets,
  lensRenderSystemDefaults,
  onLensRenderAssignmentChange,
}: {
  views: FrameRenderView[];
  disabled: boolean;
  scope: LensRenderingScope;
  onScopeChange: (scope: LensRenderingScope) => void;
  onChange: (axis: FrameViewAxis, render: LensClipRenderSettings) => void;
  lensRenderPresetId: string | null;
  useLensRenderPreset: boolean;
  lensRenderPresets: LensRenderingPreset[];
  lensRenderSystemDefaults?: LensClipRenderSettings | null;
  onLensRenderAssignmentChange?: (next: {
    lensRenderPresetId: string | null;
    useLensRenderPreset: boolean;
  }) => void;
}) {
  const clipViews = viewsWithValidClip(views);
  if (!clipViews.length) return null;
  const frontView = clipViews.find((view) => view.view === "front");
  const sideView = clipViews.find((view) => view.view === "side");
  const activeView =
    scope === "front"
      ? frontView
      : scope === "side"
        ? sideView
        : frontView ?? sideView ?? clipViews[0];

  const activePresets = lensRenderPresets.filter(
    (p) => p.isActive || p.id === lensRenderPresetId,
  );
  const assignedPreset = resolveAssignedLensRenderPreset(
    { lensRenderPresetId, useLensRenderPreset },
    activePresets,
  );
  const resolved = resolveFrameLensRenderSettings(
    { lensRenderPresetId, useLensRenderPreset },
    activeView?.clipConfig?.render,
    activePresets,
    lensRenderSystemDefaults,
  );

  const panelValue: LensClipRenderSettings = {
    automaticMaterialBehavior: resolved.automaticMaterialBehavior,
    originalLensColorInfluence: resolved.originalLensColorInfluence,
    materialInfluence: resolved.materialInfluence,
    baseBrightness: resolved.baseBrightness,
    baseGamma: resolved.baseGamma,
    glassAbsorption: resolved.glassAbsorption,
    glassDiffusion: resolved.glassDiffusion,
    glassDepth: resolved.glassDepth,
    tintLayerOpacity: resolved.tintLayerOpacity,
    lensOpacity: resolved.lensOpacity,
    lensTransmission: resolved.lensTransmission,
    reflectionEnabled: resolved.reflectionEnabled,
    reflectionOpacity: resolved.reflectionOpacity,
    reflectionStrength: resolved.reflectionStrength,
    reflectionBlur: resolved.reflectionBlur,
    reflectionPosition: resolved.reflectionPosition,
    reflectionOffsetX: resolved.reflectionOffsetX,
    reflectionOffsetY: resolved.reflectionOffsetY,
    reflectionScale: resolved.reflectionScale,
    reflectionAngle: resolved.reflectionAngle,
    mirrorReflection: resolved.mirrorReflection,
    reflectionRightAngle: resolved.reflectionRightAngle,
    reflectionRightOffsetX: resolved.reflectionRightOffsetX,
    reflectionRightOffsetY: resolved.reflectionRightOffsetY,
    reflectionRightScale: resolved.reflectionRightScale,
    reflectionRightOpacity: resolved.reflectionRightOpacity,
    reflectionRightBlur: resolved.reflectionRightBlur,
    baseGlassDarkness: resolved.baseGlassDarkness,
    baseGlassRichness: resolved.baseGlassRichness,
    baseGlassNeutralization: resolved.baseGlassNeutralization,
    internalReflectionEnabled: resolved.internalReflectionEnabled,
    internalReflectionOpacity: resolved.internalReflectionOpacity,
    internalReflectionSoftness: resolved.internalReflectionSoftness,
    internalReflectionScale: resolved.internalReflectionScale,
    internalReflectionAngle: resolved.internalReflectionAngle,
    fresnelEnabled: resolved.fresnelEnabled,
    fresnelStrength: resolved.fresnelStrength,
    fresnelWidth: resolved.fresnelWidth,
    fresnelSoftness: resolved.fresnelSoftness,
    edgeDarkness: resolved.edgeDarkness,
    backgroundVisibility: resolved.backgroundVisibility,
    environmentTransparency: resolved.environmentTransparency,
    centerDensity: resolved.centerDensity,
    edgeDensity: resolved.edgeDensity,
    edgeSoftness: resolved.edgeSoftness,
    edgeOpacity: resolved.edgeOpacity,
  };

  const applyCustomSettings = (render: LensClipRenderSettings) => {
    if (!activeView) return;
    onLensRenderAssignmentChange?.({
      lensRenderPresetId: lensRenderPresetId ?? assignedPreset?.id ?? null,
      useLensRenderPreset: false,
    });
    const sparse = buildSparseFrameRenderOverride(
      assignedPreset?.settings,
      render,
      lensRenderSystemDefaults,
    );
    onChange(activeView.view, { ...sparse, renderScope: scope });
  };

  const selectRenderingMode = (usePreset: boolean) => {
    if (!activeView) return;
    onLensRenderAssignmentChange?.({
      lensRenderPresetId: lensRenderPresetId ?? assignedPreset?.id ?? null,
      useLensRenderPreset: usePreset,
    });
    // Entering override starts with no differences, so untouched properties keep inheriting.
    onChange(activeView.view, { renderScope: scope });
  };

  const selectPreset = (presetId: string | null) => {
    onLensRenderAssignmentChange?.({
      lensRenderPresetId: presetId,
      useLensRenderPreset: true,
    });
    if (activeView?.clipConfig) {
      onChange(activeView.view, { renderScope: scope });
    }
  };

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Lens rendering</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Preset mode stays linked to the database record. Override mode stores sparse values for
            this frame while untouched properties continue to inherit.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
            useLensRenderPreset
              ? "border-border bg-background text-muted-foreground"
              : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
          )}
        >
          {useLensRenderPreset
            ? `Using preset${assignedPreset ? `: ${assignedPreset.name}` : ""}`
            : "Custom settings"}
        </span>
      </div>

      <fieldset className="mb-4 space-y-2" disabled={disabled || !onLensRenderAssignmentChange}>
        <legend className="mb-1 text-xs font-medium text-foreground">Rendering Mode</legend>
        <label className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
          <input
            type="radio"
            name="lens-rendering-mode"
            className="mt-0.5 accent-foreground"
            checked={useLensRenderPreset}
            onChange={() => selectRenderingMode(true)}
          />
          <span>
            <span className="font-medium text-foreground">Use Preset (Recommended)</span>
            <span className="mt-0.5 block text-muted-foreground">
              Values are read-only and remain linked to the selected preset.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
          <input
            type="radio"
            name="lens-rendering-mode"
            className="mt-0.5 accent-foreground"
            checked={!useLensRenderPreset}
            onChange={() => selectRenderingMode(false)}
          />
          <span>
            <span className="font-medium text-foreground">Override Rendering</span>
            <span className="mt-0.5 block text-muted-foreground">
              Store only this frame&apos;s differences; all other values inherit from the preset.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-foreground">Rendering preset</span>
          <select
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            disabled={disabled || !onLensRenderAssignmentChange}
            value={lensRenderPresetId ?? assignedPreset?.id ?? ""}
            onChange={(e) => selectPreset(e.target.value || null)}
          >
            {activePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
                {preset.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!useLensRenderPreset ? (
        <fieldset className="mb-4 space-y-2" disabled={disabled}>
          <legend className="mb-2 text-xs font-medium text-foreground">Custom scope</legend>
          {([
            ["global", "Global (recommended)", true],
            ["front", "Front View Only", Boolean(frontView)],
            ["side", "Side View Only", Boolean(sideView)],
          ] as const).map(([value, label, available]) => (
            <label
              key={value}
              className={cn(
                "flex items-center gap-2 text-xs",
                available ? "text-foreground" : "text-muted-foreground opacity-60",
              )}
            >
              <input
                type="radio"
                name="lens-rendering-scope"
                value={value}
                checked={scope === value}
                disabled={disabled || !available}
                onChange={() => onScopeChange(value)}
                className="h-4 w-4 accent-foreground"
              />
              {label}
            </label>
          ))}
        </fieldset>
      ) : null}

      {activeView ? (
        <LensRenderingSettingsPanel
          value={panelValue}
          disabled={disabled || useLensRenderPreset}
          onChange={applyCustomSettings}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Configure the selected view&apos;s lens clip before adjusting its rendering.
        </p>
      )}
    </section>
  );
}

function LensEditorForView({
  axis,
  side,
  view,
  editSession,
  editMode = "polygon",
  getWorkingPlate,
  initialMask,
  onChange,
  onPlateError,
}: {
  axis: FrameViewAxis;
  side: FrameLensSide;
  view: FrameRenderView;
  editSession: number;
  editMode?: LensEditorMode;
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
      key={`${editorPlateKey(view)}|${side}|${editMode}`}
      plateUrl={plate.url}
      width={plate.width}
      height={plate.height}
      focusedLensId={side}
      editMode={editMode}
      initialMask={initialMask}
      lensRevision={editSession}
      onChange={onChange}
    />
  );
}
