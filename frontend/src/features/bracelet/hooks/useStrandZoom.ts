import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { shouldApplyCanvasWheelZoom, shouldStartCanvasPan } from "../interaction";
import {
  applyRenderCameraToElement,
  cloneRenderCamera,
  createMatchingPairCamera,
  initializeBraceletCamera,
  isRenderCameraDebugEnabled,
  logRenderCameraSnapshot,
  RENDER_CAMERA_SAFETY_MARGIN,
  refitMatchingPairCamera,
  syncRenderScale,
  type RenderCamera,
  type RenderCameraLayoutInput,
} from "../render-camera";
import { MATCHING_PAIR_CHROME_HEIGHT_PX } from "../strand-camera";
import {
  measureStrandContentExtent,
  sanitizeMeasuredContentExtent,
} from "../strand-content-extent";
import { TWIN_STRAND_PREVIEW_GAP_PX } from "../strand-viewport";

export const STRAND_ZOOM_MIN = 0.55;
export const STRAND_ZOOM_MAX = 3;
export const STRAND_TWIN_DEFAULT_ZOOM = 1.02;

const ZOOM_BUTTON_STEP = 0.08;
const ZOOM_WHEEL_SENSITIVITY = 0.0011;
const ZOOM_SMOOTH_FACTOR = 0.28;
const ZOOM_SNAP_EPSILON = 0.006;
const PAN_DRAG_THRESHOLD_PX = 5;
const STRAND_CHROME_Y_PX = MATCHING_PAIR_CHROME_HEIGHT_PX;

export interface StrandZoomOptions {
  suspendPan?: boolean;
  panMode?: boolean;
  /** When false, camera init is deferred until the canvas viewport is measured. */
  layoutReady?: boolean;
}

export interface StrandPan {
  x: number;
  y: number;
}

export interface StrandZoomLayout {
  viewportWidthPx: number;
  viewportHeightPx: number;
  layoutCanvasSize: number;
  twinning: boolean;
  /**
   * When wrist size, bead set, or hang calibration changes, bump this so Fit
   * remeasures painted bounds (dangling charms) without treating it as a
   * viewport resize that resets zoom.
   */
  contentKey?: string;
}

export interface StrandZoomRefs {
  zoomSurfaceRef?: RefObject<HTMLElement | null>;
  containerRef?: RefObject<HTMLElement | null>;
  viewportRef?: RefObject<HTMLElement | null>;
  contentRef?: RefObject<HTMLElement | null>;
}

function clampZoom(value: number) {
  return Math.max(STRAND_ZOOM_MIN, Math.min(STRAND_ZOOM_MAX, value));
}

function clampPan(pan: StrandPan, maxX: number, maxY: number): StrandPan {
  return {
    x: maxX > 0 ? Math.min(maxX, Math.max(-maxX, pan.x)) : 0,
    y: maxY > 0 ? Math.min(maxY, Math.max(-maxY, pan.y)) : 0,
  };
}

function layoutSignature(layout: StrandZoomLayout): string {
  return `${layout.layoutCanvasSize}|${layout.twinning}|${layout.viewportWidthPx}|${layout.viewportHeightPx}|${layout.contentKey ?? ""}`;
}

function viewportSignature(layout: StrandZoomLayout): string {
  return `${layout.layoutCanvasSize}|${layout.twinning}|${layout.viewportWidthPx}|${layout.viewportHeightPx}`;
}

function toLayoutInput(layout: StrandZoomLayout): RenderCameraLayoutInput {
  return {
    viewportWidthPx: layout.viewportWidthPx,
    viewportHeightPx: layout.viewportHeightPx,
    layoutCanvasSizePx: layout.layoutCanvasSize,
    twinning: layout.twinning,
  };
}

function isLayoutMeasurable(layout: StrandZoomLayout): boolean {
  return (
    layout.viewportWidthPx > 0 &&
    layout.viewportHeightPx > 0 &&
    layout.layoutCanvasSize > 0
  );
}

function measureContentExtent(content: HTMLElement) {
  return measureStrandContentExtent(content);
}

function expectedContentExtent(
  layout: StrandZoomLayout,
  camera: RenderCamera,
): { width: number; height: number } {
  const scaled = layout.layoutCanvasSize * camera.renderScale;
  if (!layout.twinning) {
    return { width: scaled, height: scaled + STRAND_CHROME_Y_PX };
  }
  const pairLayout = camera.matchingPairLayout ?? "side-by-side";
  if (pairLayout === "stacked") {
    return {
      width: scaled,
      height: scaled * 2 + TWIN_STRAND_PREVIEW_GAP_PX + STRAND_CHROME_Y_PX,
    };
  }
  return {
    width: scaled * 2 + TWIN_STRAND_PREVIEW_GAP_PX,
    height: scaled + STRAND_CHROME_Y_PX,
  };
}

/**
 * Auto-fit camera to measured rendered content bounds after layout changes.
 *
 * The viewport uses `overflow-hidden`, so hanging/extended charm visuals can clip when
 * wrist size changes unless we reframe. We recompute only `fitScale` and preserve the
 * user's `camera.zoom`, keeping zoom level independent from wrist-size changes —
 * except when content itself remounts (layout mode / calibration), where we reset zoom
 * so the label does not stay at 300% while fitScale is crushed.
 */
function computeFitScaleFromMeasuredBounds(input: {
  layout: StrandZoomLayout;
  camera: RenderCamera;
  measured: { width: number; height: number };
}): number | null {
  const { layout, camera, measured } = input;
  const sanitized = sanitizeMeasuredContentExtent(measured, layout.layoutCanvasSize);
  const w = sanitized.width;
  const h = sanitized.height;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;

  const budgetW = layout.viewportWidthPx * RENDER_CAMERA_SAFETY_MARGIN;
  const budgetH = layout.viewportHeightPx * RENDER_CAMERA_SAFETY_MARGIN;
  if (budgetW <= 0 || budgetH <= 0) return null;

  let desiredRenderScale = Math.min(budgetW / w, budgetH / h);
  if (!Number.isFinite(desiredRenderScale) || desiredRenderScale <= 0) return null;

  // Never crush below half of a canvas-only fit — keeps the ring readable after bad measures.
  const canvasFit = Math.min(
    budgetW / Math.max(1, layout.layoutCanvasSize),
    budgetH / Math.max(1, layout.layoutCanvasSize + STRAND_CHROME_Y_PX),
  );
  if (Number.isFinite(canvasFit) && canvasFit > 0) {
    desiredRenderScale = Math.max(desiredRenderScale, canvasFit * 0.45);
  }

  const zoom = camera.zoom;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;

  const desiredFitScale = desiredRenderScale / zoom;
  if (!Number.isFinite(desiredFitScale) || desiredFitScale <= 0) return null;

  return desiredFitScale;
}

/**
 * Viewport pan + zoom — backed by immutable single/twin RenderCamera objects.
 * Display scale is exclusively camera.renderScale.
 */
export function useStrandZoom(
  refs: StrandZoomRefs,
  layout: StrandZoomLayout,
  options: StrandZoomOptions = {},
) {
  const { zoomSurfaceRef, containerRef, viewportRef, contentRef } = refs;
  const { suspendPan = false, panMode = false, layoutReady = false } = options;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const singleCameraRef = useRef<RenderCamera | null>(null);
  const twinCameraRef = useRef<RenderCamera | null>(null);
  const prevTwinningRef = useRef(layout.twinning);
  const prevLayoutSigRef = useRef("");
  const prevViewportSigRef = useRef("");
  const prevContentKeyRef = useRef(layout.contentKey ?? "");
  const initializedRef = useRef(false);
  const swappingRef = useRef(false);
  const debugRef = useRef(isRenderCameraDebugEnabled());

  const activeCameraRef = useRef<RenderCamera>(
    initializeBraceletCamera(toLayoutInput(layout)),
  );

  const [zoomTarget, setZoomTarget] = useState(1);
  const [zoomSmooth, setZoomSmooth] = useState(1);
  const [pan, setPan] = useState<StrandPan>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [matchingPairLayout, setMatchingPairLayout] = useState<"side-by-side" | "stacked">(
    "side-by-side",
  );
  const [fitScale, setFitScale] = useState(1);
  const [renderScale, setRenderScale] = useState(1);

  const panDragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    armed: boolean;
    pointerId: number;
  } | null>(null);
  const [panPointerId, setPanPointerId] = useState<number | null>(null);
  const panBoundsRef = useRef({ maxX: 0, maxY: 0 });
  const isPanningRef = useRef(false);
  const zoomSmoothRef = useRef(1);
  const panRef = useRef<StrandPan>({ x: 0, y: 0 });
  panRef.current = pan;

  const resolveActiveCamera = useCallback((): RenderCamera => {
    return layoutRef.current.twinning && twinCameraRef.current
      ? twinCameraRef.current
      : singleCameraRef.current ?? activeCameraRef.current;
  }, []);

  const writeActiveCamera = useCallback((camera: RenderCamera) => {
    const next = syncRenderScale(cloneRenderCamera(camera));
    if (layoutRef.current.twinning) {
      twinCameraRef.current = next;
    } else {
      singleCameraRef.current = next;
    }
    activeCameraRef.current = next;
    setFitScale(next.fitScale);
    setRenderScale(next.renderScale);
    return next;
  }, []);

  const syncRuntimeFromCamera = useCallback((camera: RenderCamera) => {
    const next = cloneRenderCamera(camera);
    activeCameraRef.current = next;
    zoomSmoothRef.current = next.zoom;
    setZoomTarget(next.zoom);
    setZoomSmooth(next.zoom);
    setFitScale(next.fitScale);
    setRenderScale(next.renderScale);
    panRef.current = { x: next.panX, y: next.panY };
    setPan({ x: next.panX, y: next.panY });
    if (next.matchingPairLayout) {
      setMatchingPairLayout(next.matchingPairLayout);
    }
    return next;
  }, []);

  const applyTransform = useCallback(() => {
    applyRenderCameraToElement(contentRef?.current, activeCameraRef.current);
  }, [contentRef]);

  const emitDebug = useCallback(
    (label: string) => {
      if (!debugRef.current) return;
      const mode = layoutRef.current.twinning ? "twin" : "single";
      logRenderCameraSnapshot(label, mode, activeCameraRef.current);
    },
    [],
  );

  const measurePanBounds = useCallback(() => {
    const container = viewportRef?.current ?? containerRef?.current;
    const content = contentRef?.current;
    if (!container || !content) {
      panBoundsRef.current = { maxX: 0, maxY: 0 };
      return;
    }
    const camera = activeCameraRef.current;
    const extent = measureContentExtent(content);
    const expected = expectedContentExtent(layoutRef.current, camera);
    const contentW = Math.max(extent.width, expected.width);
    const contentH = Math.max(extent.height, expected.height);
    const zoomSlack = Math.max(
      0,
      (camera.renderScale - 1) * layoutRef.current.layoutCanvasSize * 0.35,
    );
    panBoundsRef.current = {
      maxX: Math.max(0, (contentW - container.clientWidth) / 2 + zoomSlack),
      maxY: Math.max(0, (contentH - container.clientHeight) / 2 + zoomSlack),
    };
  }, [containerRef, viewportRef, contentRef]);

  const finishPanDrag = useCallback((pointerId?: number) => {
    const drag = panDragRef.current;
    if (drag && pointerId !== undefined && drag.pointerId !== pointerId) return;
    if (drag?.armed) {
      writeActiveCamera({
        ...activeCameraRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
      });
      setPan({ ...panRef.current });
    }
    panDragRef.current = null;
    isPanningRef.current = false;
    setIsPanning(false);
    setPanPointerId(null);
  }, [writeActiveCamera]);

  const setPanClamped = useCallback(
    (next: StrandPan, opts?: { syncState?: boolean }) => {
      measurePanBounds();
      const { maxX, maxY } = panBoundsRef.current;
      const clamped = clampPan(next, maxX, maxY);
      panRef.current = clamped;
      writeActiveCamera({ ...activeCameraRef.current, panX: clamped.x, panY: clamped.y });
      if (opts?.syncState !== false) {
        setPan(clamped);
      }
      applyTransform();
    },
    [measurePanBounds, writeActiveCamera, applyTransform],
  );

  const applyZoomAtPoint = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const viewport = viewportRef?.current ?? containerRef?.current;
      const camera = activeCameraRef.current;
      const oldZoom = camera.zoom;
      const newZoom = clampZoom(oldZoom * factor);
      const oldScale = camera.renderScale;
      const newScale = camera.fitScale * newZoom;
      if (Math.abs(newScale - oldScale) < ZOOM_SNAP_EPSILON) return;

      if (!viewport) {
        writeActiveCamera({ ...camera, zoom: newZoom });
        setZoomTarget(newZoom);
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const focalX = clientX - rect.left - rect.width / 2;
      const focalY = clientY - rect.top - rect.height / 2;
      const ratio = newScale / oldScale;
      setPanClamped({
        x: camera.panX - focalX * (ratio - 1),
        y: camera.panY - focalY * (ratio - 1),
      });
      writeActiveCamera({ ...activeCameraRef.current, zoom: newZoom });
      setZoomTarget(newZoom);
    },
    [containerRef, viewportRef, writeActiveCamera, setPanClamped],
  );

  const nudgeZoom = useCallback(
    (direction: 1 | -1) => {
      const viewport = viewportRef?.current ?? containerRef?.current;
      const cx = viewport ? viewport.getBoundingClientRect().left + viewport.clientWidth / 2 : 0;
      const cy = viewport ? viewport.getBoundingClientRect().top + viewport.clientHeight / 2 : 0;
      applyZoomAtPoint(1 + direction * ZOOM_BUTTON_STEP, cx, cy);
    },
    [applyZoomAtPoint, containerRef, viewportRef],
  );

  const reset = useCallback(() => {
    if (!initializedRef.current || !isLayoutMeasurable(layoutRef.current)) return;
    const camera = initializeBraceletCamera(toLayoutInput(layoutRef.current));
    writeActiveCamera(camera);
    syncRuntimeFromCamera(camera);
    applyTransform();
    // Reframe to painted bounds (dangling hang) after the canvas-only init zoom.
    if (contentRef?.current) {
      const measured = measureContentExtent(contentRef.current);
      const desiredFitScale = computeFitScaleFromMeasuredBounds({
        layout: layoutRef.current,
        camera: activeCameraRef.current,
        measured,
      });
      if (
        desiredFitScale != null &&
        Math.abs(desiredFitScale - activeCameraRef.current.fitScale) > 1e-4
      ) {
        writeActiveCamera({ ...activeCameraRef.current, fitScale: desiredFitScale });
        applyTransform();
      }
    }
    emitDebug("camera-reset");
  }, [contentRef, writeActiveCamera, syncRuntimeFromCamera, applyTransform, emitDebug]);

  const layoutSig = layoutSignature(layout);
  const viewportSig = viewportSignature(layout);
  const measurable = layoutReady && isLayoutMeasurable(layout);

  useLayoutEffect(() => {
    if (!measurable) return;

    swappingRef.current = true;
    const wasTwinning = prevTwinningRef.current;
    const isTwinning = layout.twinning;
    const layoutChanged = prevLayoutSigRef.current !== layoutSig;
    const viewportChanged = prevViewportSigRef.current !== viewportSig;
    const contentKey = layout.contentKey ?? "";
    const contentChanged = prevContentKeyRef.current !== contentKey;

    const applyMeasuredFit = () => {
      if (
        !contentRef?.current ||
        layout.viewportWidthPx <= 0 ||
        layout.viewportHeightPx <= 0
      ) {
        return;
      }
      const measured = measureContentExtent(contentRef.current);
      const desiredFitScale = computeFitScaleFromMeasuredBounds({
        layout,
        camera: activeCameraRef.current,
        measured,
      });
      if (
        desiredFitScale != null &&
        Math.abs(desiredFitScale - activeCameraRef.current.fitScale) > 1e-4
      ) {
        writeActiveCamera({ ...activeCameraRef.current, fitScale: desiredFitScale });
        activeCameraRef.current = resolveActiveCamera();
      }
    };

    if (!initializedRef.current) {
      const camera = initializeBraceletCamera(toLayoutInput(layout));
      singleCameraRef.current = camera;
      syncRuntimeFromCamera(camera);
      initializedRef.current = true;
      prevLayoutSigRef.current = layoutSig;
      prevViewportSigRef.current = viewportSig;
      prevContentKeyRef.current = contentKey;
      prevTwinningRef.current = isTwinning;
      activeCameraRef.current = camera;
      applyTransform();
      // Canvas-only init zoom; pull out further when dangling shells overhang.
      applyMeasuredFit();
      applyTransform();
      swappingRef.current = false;
      emitDebug("camera-init");
      return;
    }

    if (!wasTwinning && isTwinning) {
      singleCameraRef.current = cloneRenderCamera(activeCameraRef.current);
      if (twinCameraRef.current) {
        syncRuntimeFromCamera(cloneRenderCamera(twinCameraRef.current));
      } else {
        const twin = createMatchingPairCamera(toLayoutInput(layout));
        twinCameraRef.current = twin;
        syncRuntimeFromCamera(twin);
      }
      emitDebug("twin-enter");
    } else if (wasTwinning && !isTwinning) {
      if (twinCameraRef.current) {
        twinCameraRef.current = cloneRenderCamera(activeCameraRef.current);
      }
      syncRuntimeFromCamera(cloneRenderCamera(singleCameraRef.current!));
      emitDebug("twin-exit-restored");
    } else if (isTwinning && twinCameraRef.current) {
      const refitted = refitMatchingPairCamera(twinCameraRef.current, toLayoutInput(layout));
      twinCameraRef.current = refitted;
      syncRuntimeFromCamera(refitted);
    } else if (!isTwinning && contentChanged && !viewportChanged) {
      // Layout mode / wrist / calibration remounts the strand. Reset zoom so we do not
      // keep a 300% label while fitScale is crushed to fit new shell bounds.
      const camera = initializeBraceletCamera(toLayoutInput(layout));
      singleCameraRef.current = camera;
      syncRuntimeFromCamera(camera);
      emitDebug("camera-content-refit");
    } else if (!isTwinning && viewportChanged && singleCameraRef.current) {
      const camera = initializeBraceletCamera(toLayoutInput(layout), {
        preserve: singleCameraRef.current,
      });
      singleCameraRef.current = camera;
      syncRuntimeFromCamera(camera);
      emitDebug("camera-viewport-resize");
    }

    activeCameraRef.current = resolveActiveCamera();
    prevTwinningRef.current = isTwinning;
    prevLayoutSigRef.current = layoutSig;
    prevViewportSigRef.current = viewportSig;
    prevContentKeyRef.current = contentKey;

    // Prevent overflow-hidden clipping on layout / wrist / content changes by auto-fitting.
    if (layoutChanged) {
      applyMeasuredFit();
    }

    applyTransform();
    swappingRef.current = false;

    // Remounted strand slots may not have final offsets in this frame — refit once painted.
    if (contentChanged && !isTwinning) {
      const frame = requestAnimationFrame(() => {
        if (!initializedRef.current || !contentRef?.current) return;
        applyMeasuredFit();
        applyTransform();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [
    measurable,
    layout.twinning,
    layoutSig,
    viewportSig,
    layout,
    contentRef,
    syncRuntimeFromCamera,
    resolveActiveCamera,
    applyTransform,
    writeActiveCamera,
    emitDebug,
  ]);

  useLayoutEffect(() => {
    if (measurable) applyTransform();
  }, [measurable, applyTransform, renderScale, pan]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (swappingRef.current || !initializedRef.current) return;
      const target = zoomTarget;
      const current = zoomSmoothRef.current;
      const diff = target - current;
      if (Math.abs(diff) < ZOOM_SNAP_EPSILON) {
        if (current !== target) {
          zoomSmoothRef.current = target;
          writeActiveCamera({ ...activeCameraRef.current, zoom: target });
          applyTransform();
          setZoomSmooth(target);
          setRenderScale(activeCameraRef.current.renderScale);
        }
        return;
      }
      const next = current + diff * ZOOM_SMOOTH_FACTOR;
      zoomSmoothRef.current = next;
      const updated = writeActiveCamera({ ...activeCameraRef.current, zoom: next });
      applyTransform();
      setZoomSmooth(next);
      setRenderScale(updated.renderScale);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [zoomTarget, writeActiveCamera, applyTransform]);

  useEffect(() => {
    if (!layout.twinning && !swappingRef.current && initializedRef.current) {
      measurePanBounds();
    }
  }, [zoomTarget, layout.twinning, layoutSig, measurePanBounds]);

  useEffect(() => {
    if (panMode) return;
    finishPanDrag();
  }, [panMode, finishPanDrag]);

  useEffect(() => {
    if (!suspendPan) return;
    finishPanDrag();
  }, [suspendPan, finishPanDrag]);

  useEffect(() => {
    const el = zoomSurfaceRef?.current ?? viewportRef?.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (!shouldApplyCanvasWheelZoom(e, el)) return;
      e.preventDefault();
      e.stopPropagation();
      applyZoomAtPoint(Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomSurfaceRef, viewportRef, applyZoomAtPoint]);

  useEffect(() => {
    if (panPointerId === null) return;
    const activePointerId = panPointerId;
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      const drag = panDragRef.current;
      if (!drag || drag.pointerId !== activePointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.armed) {
        if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD_PX) return;
        drag.armed = true;
        isPanningRef.current = true;
        setIsPanning(true);
      }
      setPanClamped({ x: drag.panX + dx, y: drag.panY + dy }, { syncState: false });
    };
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId === activePointerId) finishPanDrag(activePointerId);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
    };
  }, [panPointerId, finishPanDrag, setPanClamped]);

  const onPanPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!panMode || suspendPan || e.button !== 0) return;
      if (!shouldStartCanvasPan(e.target)) return;
      finishPanDrag();
      const camera = activeCameraRef.current;
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: camera.panX,
        panY: camera.panY,
        armed: false,
        pointerId: e.pointerId,
      };
      setPanPointerId(e.pointerId);
    },
    [panMode, suspendPan, finishPanDrag],
  );

  const isZoomAnimating = Math.abs(zoomTarget - zoomSmooth) > ZOOM_SNAP_EPSILON;

  return {
    zoom: zoomTarget,
    zoomSmooth,
    viewScale: renderScale,
    fitScale,
    displayZoom: zoomTarget,
    pan,
    camera: {
      zoom: activeCameraRef.current.zoom,
      panX: activeCameraRef.current.panX,
      panY: activeCameraRef.current.panY,
    },
    matchingPairLayout,
    isPanning,
    isZoomAnimating,
    panMode,
    zoomIn: () => nudgeZoom(1),
    zoomOut: () => nudgeZoom(-1),
    reset,
    onPanPointerDown,
    onPanPointerMove: () => {},
    onPanPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => finishPanDrag(e.pointerId),
    onPanPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => finishPanDrag(e.pointerId),
    zoomMin: STRAND_ZOOM_MIN,
    zoomMax: STRAND_ZOOM_MAX,
  };
}

export { TWIN_STRAND_PREVIEW_GAP_PX };
