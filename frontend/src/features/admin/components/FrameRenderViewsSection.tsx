import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { FramePlateCropEditorHandle } from "./FramePlateCropEditor";
import { Check, Copy, Loader2, RotateCcw, Scan, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyFrontGeometryToSideMask } from "@/features/admin/lib/frame-duplicate";
import {
  applyDetailStampToMask,
  deleteDetailStamp,
  listDetailStamps,
  saveDetailStampFromMask,
  type DetailStamp,
} from "@/features/admin/lib/detail-stamps";
import { flushFrameRenderViews, patchFrameRenderView } from "@/features/admin/lib/frame-render-flush";
import { isApiError, uploadApi } from "@/services/api";
import type { FrameRenderView, FrameViewAxis } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES, FRAME_VIEW_LABELS } from "@/types/frame-rendering";
import {
  editorPlateKey,
  enrichMaskHolesFromSource,
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

const EXPANDED_PANELS = new Set<ExpandedPanel>(["frame", "left", "right", "exclusions"]);

export function parseFrameExpandedEditor(
  axisRaw: string | null,
  panelRaw: string | null,
): ExpandedEditor | null {
  if (!axisRaw || !panelRaw) return null;
  if (!FRAME_VIEW_AXES.includes(axisRaw as FrameViewAxis)) return null;
  if (!EXPANDED_PANELS.has(panelRaw as ExpandedPanel)) return null;
  return { axis: axisRaw as FrameViewAxis, panel: panelRaw as ExpandedPanel };
}

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

/**
 * Prefer in-progress editor draft/preview, but restore cutouts from the saved view when
 * the local mask lost empty `holes` while clip still has `holePathDs`.
 */
function resolveEditorMask(
  view: FrameRenderView,
  local: MaskConfig | null | undefined,
): MaskConfig | null {
  const resolved = resolveMaskConfigForEditor(view);
  if (local && hasAnyLensMask(local)) {
    return resolved ? enrichMaskHolesFromSource(local, resolved) : local;
  }
  return resolved;
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
  /** Optional model family — powers Manual Detail stamps. */
  modelFamily?: string | null;
  lensRenderPresetId?: string | null;
  useLensRenderPreset?: boolean;
  lensRenderPresets?: LensRenderingPreset[];
  lensRenderSystemDefaults?: LensClipRenderSettings | null;
  onLensRenderAssignmentChange?: (next: {
    lensRenderPresetId: string | null;
    useLensRenderPreset: boolean;
  }) => void;
  /** Fired when live editor drafts change (mask/crop) before they are committed to `views`. */
  onDraftTouch?: () => void;
  /** Controlled expanded crop/lens/details panel (URL deep link). */
  expandedEditor?: ExpandedEditor | null;
  onExpandedEditorChange?: (next: ExpandedEditor | null) => void;
}

export type FrameRenderViewsSectionHandle = {
  /** Commit open editor drafts into render views (does not close editors). */
  flushPendingEdits: () => FrameRenderView[];
};

/**
 * Front + side plates with a unified per-view workspace (tool strip → one editor).
 */
export const FrameRenderViewsSection = forwardRef<
  FrameRenderViewsSectionHandle,
  FrameRenderViewsSectionProps
>(function FrameRenderViewsSection(
  {
    views,
    onChange,
    modelFamily = null,
    lensRenderPresetId = null,
    useLensRenderPreset = true,
    lensRenderPresets = [],
    lensRenderSystemDefaults,
    onLensRenderAssignmentChange,
    onDraftTouch,
    expandedEditor: expandedEditorProp,
    onExpandedEditorChange,
  },
  ref,
) {
  const expandedControlled = onExpandedEditorChange != null;
  const [expandedEditorState, setExpandedEditorState] = useState<ExpandedEditor | null>(null);
  const expandedEditor = expandedControlled ? (expandedEditorProp ?? null) : expandedEditorState;
  const setExpandedEditor = (next: ExpandedEditor | null) => {
    if (expandedControlled) onExpandedEditorChange?.(next);
    else setExpandedEditorState(next);
  };
  const [uploading, setUploading] = useState<FrameViewAxis | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [editSession, setEditSession] = useState<Partial<Record<string, number>>>({});
  const [notice, setNotice] = useState<Partial<Record<FrameViewAxis, string>>>({});
  const [noticeVariant, setNoticeVariant] = useState<Partial<Record<FrameViewAxis, "success" | "warning">>>({});
  const [exclusionSaved, setExclusionSaved] =
    useState<Partial<Record<FrameViewAxis, boolean>>>({});
  const [previewMasks, setPreviewMasks] = useState<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const draftRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const lensSnapshotRef = useRef<Partial<Record<FrameViewAxis, MaskConfig | null>>>({});
  const draftPlateUrlsRef = useRef<Partial<Record<FrameViewAxis, string>>>({});
  /** First mask change after opening an editor is hydration, not a user edit. */
  const editorHydratingRef = useRef(false);
  const exclusionSavedTimersRef =
    useRef<Partial<Record<FrameViewAxis, ReturnType<typeof setTimeout>>>>({});
  const frameCropEditorRef = useRef<FramePlateCropEditorHandle>(null);
  const [framePathReady, setFramePathReady] = useState(false);
  const [stampName, setStampName] = useState("");
  const [stampTick, setStampTick] = useState(0);
  const familyStamps = useMemo(
    () => listDetailStamps(modelFamily),
    // stampTick forces refresh after save/delete in this session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modelFamily, stampTick],
  );
  const [renderingScope, setRenderingScope] = useState<LensRenderingScope>(() =>
    resolveRenderingScope(views),
  );

  // Latest views for stable callbacks — reading through the ref keeps getWorkingPlate
  // identity constant so the lens editor's plate effect does not re-run (and recreate
  // the canvas) on every draft patch, which previously caused an infinite refresh loop.
  // Also required so chained patchView calls (upload → detect) do not clobber plateUrl.
  const viewsRef = useRef(views);
  viewsRef.current = views;

  useImperativeHandle(
    ref,
    () => ({
      flushPendingEdits: () => {
        const latestViews = viewsRef.current;
        const cropByAxis: Partial<Record<FrameViewAxis, BeadCropConfig | null>> = {};
        if (expandedEditor?.panel === "frame") {
          const config = frameCropEditorRef.current?.commitDraft();
          if (config) cropByAxis[expandedEditor.axis] = config;
        }

        const flushed = flushFrameRenderViews(latestViews, {
          cropByAxis,
          maskByAxis: { ...draftRef.current },
        });
        viewsRef.current = flushed;
        onChange(flushed);
        return flushed;
      },
    }),
    [expandedEditor, onChange],
  );

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
      const resolved = resolveMaskConfigForEditor(view);
      if (!resolved || !hasAnyLensMask(resolved)) continue;

      const existing = draftRef.current[axis];
      if (existing && hasAnyLensMask(existing)) {
        const enriched = enrichMaskHolesFromSource(existing, resolved);
        if (enriched !== existing) {
          draftRef.current[axis] = enriched;
          setPreviewMasks((prev) => ({ ...prev, [axis]: enriched }));
        }
        continue;
      }

      draftRef.current[axis] = resolved;
      setPreviewMasks((prev) => (prev[axis] ? prev : { ...prev, [axis]: resolved }));
    }
  }, [views]);

  useEffect(() => {
    setRenderingScope(resolveRenderingScope(views));
  }, [views]);

  const getView = useCallback(
    (axis: FrameViewAxis) => viewsRef.current.find((v) => v.view === axis) ?? emptyView(axis),
    [],
  );

  const patchView = useCallback(
    (axis: FrameViewAxis, patch: Partial<FrameRenderView>) => {
      const next = patchFrameRenderView(viewsRef.current, axis, patch);
      viewsRef.current = next;
      onChange(next);
    },
    [onChange],
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
    const currentViews = viewsRef.current;
    const next = FRAME_VIEW_AXES.map((v) => {
      const current = currentViews.find((x) => x.view === v) ?? emptyView(v);
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
    viewsRef.current = next;
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
    const clipViews = viewsWithValidClip(viewsRef.current);
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
    editorHydratingRef.current = true;
    setFramePathReady(false);
    if (panel === "left" || panel === "right" || panel === "exclusions") {
      const view = getView(axis);
      const restored = resolveEditorMask(
        view,
        previewMasks[axis] ?? draftRef.current[axis] ?? null,
      );
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
    if (panel === "frame") {
      const view = getView(axis);
      setFramePathReady(Boolean(view.plateCropConfig && isBeadCropConfigValid(view.plateCropConfig)));
    }
    setExpandedEditor({ axis, panel });
  };

  // Restore editor session when deep-linked / URL-controlled via ?axis=&panel=
  useEffect(() => {
    if (!expandedControlled || !expandedEditor) return;
    const { axis, panel } = expandedEditor;
    editorHydratingRef.current = true;
    setFramePathReady(false);
    if (panel === "left" || panel === "right" || panel === "exclusions") {
      const view = getView(axis);
      const restored = resolveEditorMask(
        view,
        previewMasks[axis] ?? draftRef.current[axis] ?? null,
      );
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
    if (panel === "frame") {
      const view = getView(axis);
      setFramePathReady(Boolean(view.plateCropConfig && isBeadCropConfigValid(view.plateCropConfig)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-hydrate when panel identity changes
  }, [expandedControlled, expandedEditor?.axis, expandedEditor?.panel]);

  const resolvePreviewMask = (axis: FrameViewAxis, view: FrameRenderView): MaskConfig | null => {
    return resolveEditorMask(
      view,
      previewMasks[axis] ?? draftRef.current[axis] ?? null,
    );
  };

  const handleUpload = async (axis: FrameViewAxis, file: File) => {
    setUploading(axis);
    setNotice((prev) => ({ ...prev, [axis]: undefined }));
    setNoticeVariant((prev) => ({ ...prev, [axis]: undefined }));
    // Keep crop panel intent: open Crop after upload even if another panel was open.
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
      onDraftTouch?.();

      // Always open Crop immediately so upload → editor needs no extra click (front + side).
      openEditor(axis, "frame");

      // Best-effort dual lens detection; patchView chains through viewsRef so plateUrl is kept.
      try {
        const detection = detectFrameLensMaskFromSource(img);
        if (detection.config && isDualLensMaskValid(detection.config)) {
          commitMaskToView(axis, detection.config);
          const conf = detection.confidence ?? 0;
          setAxisNotice(
            axis,
            detection.message ??
              (conf >= 0.7
                ? "Original saved and both lenses detected — crop the frame, then review lenses."
                : "Original saved with starting lens polygons — crop the frame, then adjust lenses."),
            conf >= 0.7 ? "success" : "warning",
          );
        } else {
          setAxisNotice(
            axis,
            "Original saved. Draw the frame crop path, then detect or draw lenses.",
            "success",
          );
        }
      } catch {
        setAxisNotice(
          axis,
          "Original saved. Draw the frame crop path, then detect or draw lenses.",
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

    const next = flushFrameRenderViews(viewsRef.current, { cropByAxis: { [axis]: config } });
    viewsRef.current = next;
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

  const handleEditorChange = useCallback((axis: FrameViewAxis, mask: MaskConfig | null) => {
    // Live edits stay in draft only — avoid mask→clip conversion and parent form
    // re-renders on every pointer frame. Commit via Save / flushPendingEdits.
    draftRef.current[axis] = mask;
    // Skip the hydration callback that fires when an editor panel first opens.
    if (editorHydratingRef.current) {
      editorHydratingRef.current = false;
      return;
    }
    onDraftTouch?.();
  }, [onDraftTouch]);

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
      toast.error("Define the lens openings before saving frame parts.");
      return;
    }
    if (commitMaskToView(axis, mask)) {
      setAxisNotice(axis, "Frame parts saved to draft.", "success");
      const existingTimer = exclusionSavedTimersRef.current[axis];
      if (existingTimer) clearTimeout(existingTimer);
      setExclusionSaved((prev) => ({ ...prev, [axis]: true }));
      exclusionSavedTimersRef.current[axis] = setTimeout(() => {
        setExclusionSaved((prev) => ({ ...prev, [axis]: false }));
        delete exclusionSavedTimersRef.current[axis];
      }, 2200);
    }
  };

  const copyFrontGeometryToSide = () => {
    const front = getView("front");
    const side = getView("side");
    if (!side.plateUrl || !(side.width > 0) || !(side.height > 0)) {
      toast.error("Upload a side photo before copying front geometry.");
      return;
    }
    const frontMask =
      draftRef.current.front ??
      previewMasks.front ??
      resolveMaskConfigForEditor(front);
    if (!frontMask || !hasAnyLensMask(frontMask)) {
      toast.error("Configure front lens openings before copying to side.");
      return;
    }
    const nextMask = copyFrontGeometryToSideMask(frontMask, side.width, side.height);
    if (!nextMask || !commitMaskToView("side", nextMask)) {
      toast.error("Could not copy front geometry to side.");
      return;
    }
    setExpandedEditor(null);
    setAxisNotice(
      "side",
      "Front lenses and Manual Details copied as a starting point — nudge for the side photo.",
      "success",
    );
    toast.success("Front geometry copied to side. Adjust openings to match the side photo.");
  };

  const saveCurrentDetailsAsStamp = (axis: FrameViewAxis) => {
    if (!modelFamily?.trim()) {
      toast.error("Set Model family on the frame before saving detail stamps.");
      return;
    }
    const mask =
      draftRef.current[axis] ??
      previewMasks[axis] ??
      resolveMaskConfigForEditor(getView(axis));
    const stamp = saveDetailStampFromMask(modelFamily, stampName || "Detail set", mask);
    if (!stamp) {
      toast.error("Add at least one Manual Detail before saving a stamp.");
      return;
    }
    setStampName("");
    setStampTick((n) => n + 1);
    toast.success(`Saved stamp “${stamp.name}” for family ${modelFamily.trim()}.`);
  };

  const applyStampToAxis = (axis: FrameViewAxis, stamp: DetailStamp) => {
    const base =
      draftRef.current[axis] ??
      previewMasks[axis] ??
      resolveMaskConfigForEditor(getView(axis));
    if (!base || !isMaskConfigValid(base)) {
      toast.error("Define lens openings before applying detail stamps.");
      return;
    }
    const next = applyDetailStampToMask(base, stamp);
    if (!commitMaskToView(axis, next)) {
      toast.error("Could not apply stamp.");
      return;
    }
    openEditor(axis, "exclusions");
    toast.success(`Applied “${stamp.name}”. Nudge positions if needed.`);
  };

  const frontView = getView("front");
  const sideView = getView("side");
  const checklist = [
    {
      id: "front-plate",
      label: "Front photo",
      done: Boolean(resolveOriginalPlate(frontView).url),
    },
    {
      id: "front-crop",
      label: "Front frame crop",
      done: hasPlateCropApplied(frontView),
    },
    {
      id: "front-lenses",
      label: "Front lens openings",
      done: Boolean(frontView.clipConfig && isLensClipConfigValid(frontView.clipConfig)),
    },
    {
      id: "side-plate",
      label: "Side photo (optional)",
      done: Boolean(resolveOriginalPlate(sideView).url),
    },
    {
      id: "side-lenses",
      label: "Side lens openings",
      done: Boolean(sideView.clipConfig && isLensClipConfigValid(sideView.clipConfig)),
    },
  ];

  return (
    <div className="space-y-8 border-t border-border pt-4">
      <div>
        <h3 className="type-h3 text-base">Render views</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Unified workspace per view: Crop → Left lens → Right lens → Details. Assign a Model family
          to reuse Manual Detail stamps across sizes. Prefer Duplicate when adding another size of the
          same model.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {checklist.map((item) => (
            <li
              key={item.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                item.done
                  ? "border-status-success/30 bg-status-success/10 text-status-success"
                  : "border-border/70 bg-muted/20 text-muted-foreground",
              )}
            >
              <Check className={cn("h-3 w-3", !item.done && "opacity-30")} />
              {item.label}
            </li>
          ))}
        </ul>
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
        const canCopyFrontToSide =
          axis === "side" &&
          hasPlate &&
          Boolean(frontView.clipConfig && isLensClipConfigValid(frontView.clipConfig));

        return (
          <section key={axis} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground">{FRAME_VIEW_LABELS[axis]}</h4>
                {hasPlate ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {effectivePlateDimensions(view).width}×{effectivePlateDimensions(view).height}
                    {framePathSet
                      ? " · frame path set"
                      : committedCrop
                        ? " · processed frame"
                        : " · full original"}
                    {" · "}
                    {lensStatusLine(overlayMask)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">No plate uploaded</p>
                )}
                {notice[axis] ? <p className={`mt-1 text-xs ${noticeTone}`}>{notice[axis]}</p> : null}
              </div>
              {canCopyFrontToSide ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={working}
                  onClick={copyFrontGeometryToSide}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy front geometry
                </Button>
              ) : null}
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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 px-0.5">
                  <span className="type-label text-muted-foreground">Workspace</span>
                  {(
                    [
                      ["frame", "Crop"],
                      ["left", "Left lens"],
                      ["right", "Right lens"],
                      ["exclusions", "Details"],
                    ] as const
                  ).map(([panel, label]) => (
                    <Button
                      key={panel}
                      type="button"
                      size="sm"
                      variant={
                        expandedEditor?.axis === axis && expandedEditor.panel === panel
                          ? "default"
                          : "outline"
                      }
                      disabled={working}
                      onClick={() => openEditor(axis, panel)}
                    >
                      {label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isBusy(axis, "detect-both")}
                    onClick={() => void handleDetectBothLenses(axis)}
                  >
                    {isBusy(axis, "detect-both") ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Auto Detect Lenses
                  </Button>
                </div>

                {isFramePanelOpen ? (
                  <div className={INLINE_SECTION_ACTIVE_CLASS}>
                    <InlineEditorPanel
                      title="Crop"
                      description="Draw the visible frame boundary. Stay in this workspace — switch tools above without leaving the view."
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
                            Auto Crop
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => resetFrameInEditor(axis)}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset
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
                  </div>
                ) : null}

                {isLeftPanelOpen ? (
                  <div className={INLINE_SECTION_ACTIVE_CLASS}>
                    <InlineEditorPanel
                      title="Left lens"
                      description="Edit the left lens opening. Inner Frame lip is automatic; rivets/logos go under Details."
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
                            Auto Detect
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => resetLensSideInEditor(axis, "left")}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset
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
                          initialMask={resolveEditorMask(
                            view,
                            previewMasks[axis] ?? draftRef.current[axis] ?? null,
                          )}
                          onChange={(config) => handleEditorChange(axis, config)}
                        />
                      </Suspense>
                    </InlineEditorPanel>
                  </div>
                ) : null}

                {isRightPanelOpen ? (
                  <div className={INLINE_SECTION_ACTIVE_CLASS}>
                    <InlineEditorPanel
                      title="Right lens"
                      description="Edit the right lens opening. Inner Frame lip is automatic; rivets/logos go under Details."
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
                            Auto Detect
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => resetLensSideInEditor(axis, "right")}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset
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
                          initialMask={resolveEditorMask(
                            view,
                            previewMasks[axis] ?? draftRef.current[axis] ?? null,
                          )}
                          onChange={(config) => handleEditorChange(axis, config)}
                        />
                      </Suspense>
                    </InlineEditorPanel>
                  </div>
                ) : null}

                {isExclusionsPanelOpen ? (
                  <div className={INLINE_SECTION_ACTIVE_CLASS}>
                    <InlineEditorPanel
                      title="Manual Details"
                      description="Place rivets, screws, and logos above the glass. Smart Auto Detect finds boundaries from a click or brush; Manual Polygon is always available. Save stamps for this model family to reuse on other sizes."
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
                      <div className="mb-3 space-y-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Family stamps
                          {modelFamily?.trim() ? ` · ${modelFamily.trim()}` : ""}
                        </p>
                        {!modelFamily?.trim() ? (
                          <p className="text-[11px] text-muted-foreground">
                            Set Model family on the frame form to save and apply detail stamps.
                          </p>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <input
                                className="min-w-[10rem] flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs"
                                placeholder="Stamp name"
                                value={stampName}
                                onChange={(e) => setStampName(e.target.value)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => saveCurrentDetailsAsStamp(axis)}
                              >
                                Save as stamp
                              </Button>
                            </div>
                            {familyStamps.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground">
                                No stamps yet for this family.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {familyStamps.map((stamp) => (
                                  <li
                                    key={stamp.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-2 py-1.5 text-xs"
                                  >
                                    <span className="font-medium text-foreground">{stamp.name}</span>
                                    <span className="flex gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => applyStampToAxis(axis, stamp)}
                                      >
                                        Apply
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() => {
                                          deleteDetailStamp(modelFamily, stamp.id);
                                          setStampTick((n) => n + 1);
                                        }}
                                      >
                                        Delete
                                      </Button>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                      <Suspense fallback={<LoadingState label="Loading editor…" className="h-40" />}>
                        <LensEditorForView
                          axis={axis}
                          side="left"
                          view={view}
                          editSession={editSession[`${axis}-exclusions`] ?? 0}
                          editMode="exclusions"
                          getWorkingPlate={getWorkingPlate}
                          initialMask={resolveEditorMask(
                            view,
                            previewMasks[axis] ?? draftRef.current[axis] ?? null,
                          )}
                          onChange={(config) => handleEditorChange(axis, config)}
                        />
                      </Suspense>
                    </InlineEditorPanel>
                  </div>
                ) : null}

                {!expandedEditor || expandedEditor.axis !== axis ? (
                  <p className="px-0.5 text-[11px] text-muted-foreground">
                    Choose a workspace tool above to edit crop, lenses, or Manual Details.
                  </p>
                ) : null}
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
    glassSheetEnabled: resolved.glassSheetEnabled,
    glassSheetUrl: resolved.glassSheetUrl,
    glassSheetNaturalWidth: resolved.glassSheetNaturalWidth,
    glassSheetNaturalHeight: resolved.glassSheetNaturalHeight,
    glassSheetCrop: resolved.glassSheetCrop,
    glassSheetFit: resolved.glassSheetFit,
    glassSheetScale: resolved.glassSheetScale,
    glassSheetOffsetX: resolved.glassSheetOffsetX,
    glassSheetOffsetY: resolved.glassSheetOffsetY,
    glassSheetColorStrength: resolved.glassSheetColorStrength,
    glassSheetTextureStrength: resolved.glassSheetTextureStrength,
    glassSheetShine: resolved.glassSheetShine,
    glassSheetOccluderEnabled: resolved.glassSheetOccluderEnabled,
    glassSheetOccluderStrength: resolved.glassSheetOccluderStrength,
    glassSheetOccluderThreshold: resolved.glassSheetOccluderThreshold,
    innerFrameEnabled: resolved.innerFrameEnabled,
    innerFrameThickness: resolved.innerFrameThickness,
    innerFrameOpacity: resolved.innerFrameOpacity,
    innerFrameFeather: resolved.innerFrameFeather,
    innerFrameBlendMode: resolved.innerFrameBlendMode,
    glassTintEnabled: resolved.glassTintEnabled,
    glassTintBlend: resolved.glassTintBlend,
    glassTintShine: resolved.glassTintShine,
    darkLayerEnabled: resolved.darkLayerEnabled,
    darkLayerOpacity: resolved.darkLayerOpacity,
    darkLayerMode: resolved.darkLayerMode,
    darkLayerColor: resolved.darkLayerColor,
    darkLayerBlend: resolved.darkLayerBlend,
    edgeEnabled: resolved.edgeEnabled,
    densityGradientEnabled: resolved.densityGradientEnabled,
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
