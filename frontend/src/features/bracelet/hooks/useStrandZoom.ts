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
import { TWIN_STRAND_PREVIEW_GAP_PX } from "../strand-viewport";

export interface StrandZoomOptions {
  /** When true, pan gestures are ignored (e.g. library HTML5 drag in progress). */
  suspendPan?: boolean;
  /** When false, canvas pan is disabled — editing interactions take priority. */
  panMode?: boolean;
}

export const STRAND_ZOOM_MIN = 0.55;
export const STRAND_ZOOM_MAX = 3;
const ZOOM_BUTTON_STEP = 0.08;
const ZOOM_WHEEL_SENSITIVITY = 0.0011;
const ZOOM_SMOOTH_FACTOR = 0.28;
const ZOOM_SNAP_EPSILON = 0.006;
const PAN_DRAG_THRESHOLD_PX = 5;
const STRAND_CHROME_Y_PX = 52;

export interface StrandPan {
  x: number;
  y: number;
}

export interface StrandZoomLayout {
  /** Viewport square budget from container measurement. */
  viewportSize: number;
  /** Layout canvas side length (may exceed viewport when beads need room). */
  layoutCanvasSize: number;
  /** Fits layout canvas into viewport at zoom 1 (≤ 1). */
  autoFitScale: number;
  twinning: boolean;
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

function panNeedsUpdate(prev: StrandPan, next: StrandPan): boolean {
  return prev.x !== next.x || prev.y !== next.y;
}

function layoutSignature(layout: StrandZoomLayout): string {
  return `${layout.viewportSize}|${layout.layoutCanvasSize}|${layout.autoFitScale}|${layout.twinning}`;
}

function measureContentExtent(content: HTMLElement) {
  let width = 0;
  let height = 0;
  for (const child of Array.from(content.children)) {
    if (!(child instanceof HTMLElement)) continue;
    width = Math.max(width, child.offsetLeft + child.offsetWidth);
    height = Math.max(height, child.offsetTop + child.offsetHeight);
  }
  return {
    width: width || content.scrollWidth,
    height: height || content.scrollHeight,
  };
}

function expectedContentSize(layout: StrandZoomLayout, userZoom: number) {
  const scaled = layout.layoutCanvasSize * layout.autoFitScale * userZoom;
  return {
    width: layout.twinning ? scaled * 2 + TWIN_STRAND_PREVIEW_GAP_PX : scaled,
    height: scaled + STRAND_CHROME_Y_PX,
  };
}

function computePanBounds(
  container: HTMLElement,
  content: HTMLElement,
  layout: StrandZoomLayout,
  userZoom: number,
) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const extent = measureContentExtent(content);
  const viewScale = layout.autoFitScale * userZoom;
  const expected = expectedContentSize(layout, userZoom);
  const contentW = Math.max(extent.width, expected.width);
  const contentH = Math.max(extent.height, expected.height);
  const zoomSlack = Math.max(0, (viewScale - layout.autoFitScale) * layout.layoutCanvasSize * 0.35);

  return {
    maxX: Math.max(0, (contentW - cw) / 2 + zoomSlack),
    maxY: Math.max(0, (contentH - ch) / 2 + zoomSlack),
  };
}

/** Strand zoom (layout size) + pan offset for inspecting zoomed areas. */
export function useStrandZoom(
  refs: StrandZoomRefs,
  layout: StrandZoomLayout,
  initial = 1,
  options: StrandZoomOptions = {},
) {
  const { zoomSurfaceRef, containerRef, viewportRef, contentRef } = refs;
  const { suspendPan = false, panMode = false } = options;
  const layoutRef = useRef<StrandZoomLayout>(layout);
  layoutRef.current = layout;

  const [zoomTarget, setZoomTarget] = useState(initial);
  const [zoomSmooth, setZoomSmooth] = useState(initial);
  const [pan, setPan] = useState<StrandPan>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

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
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomSmoothRef = useRef(initial);

  const applyContentTransform = useCallback(() => {
    const el = contentRef?.current;
    if (!el) return;
    const viewScale = layoutRef.current.autoFitScale * zoomSmoothRef.current;
    const { x, y } = panRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${viewScale})`;
  }, [contentRef]);

  const finishPanDrag = useCallback((pointerId?: number) => {
    const drag = panDragRef.current;
    if (drag && pointerId !== undefined && drag.pointerId !== pointerId) return;
    if (drag?.armed) {
      setPan(panRef.current);
    }
    panDragRef.current = null;
    isPanningRef.current = false;
    setIsPanning(false);
    setPanPointerId(null);
  }, []);

  const clearPan = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    applyContentTransform();
    finishPanDrag();
  }, [finishPanDrag, applyContentTransform]);

  const measurePanBounds = useCallback(() => {
    const container = viewportRef?.current ?? containerRef?.current;
    const content = contentRef?.current;
    if (!container || !content) {
      panBoundsRef.current = { maxX: 0, maxY: 0 };
      return;
    }
    panBoundsRef.current = computePanBounds(
      container,
      content,
      layoutRef.current,
      zoomSmoothRef.current,
    );
  }, [containerRef, viewportRef, contentRef]);

  const clampPanInBounds = useCallback(() => {
    if (isPanningRef.current) return;
    measurePanBounds();
    const { maxX, maxY } = panBoundsRef.current;
    setPan((p) => {
      const next = clampPan(p, maxX, maxY);
      return panNeedsUpdate(p, next) ? next : p;
    });
  }, [measurePanBounds]);

  const setPanClamped = useCallback(
    (next: StrandPan, options?: { syncState?: boolean }) => {
      measurePanBounds();
      const { maxX, maxY } = panBoundsRef.current;
      const clamped = clampPan(next, maxX, maxY);
      panRef.current = clamped;
      applyContentTransform();
      if (options?.syncState !== false) {
        setPan((prev) => (panNeedsUpdate(prev, clamped) ? clamped : prev));
      }
    },
    [measurePanBounds, applyContentTransform],
  );

  const applyZoomAtPoint = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const viewport = viewportRef?.current ?? containerRef?.current;
      if (!viewport) {
        setZoomTarget((z) => clampZoom(z * factor));
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const focalX = clientX - rect.left - rect.width / 2;
      const focalY = clientY - rect.top - rect.height / 2;
      const oldZoom = zoomSmoothRef.current;
      const newZoom = clampZoom(oldZoom * factor);
      if (Math.abs(newZoom - oldZoom) < ZOOM_SNAP_EPSILON) return;
      const ratio = newZoom / oldZoom;
      setPanClamped({
        x: panRef.current.x - focalX * (ratio - 1),
        y: panRef.current.y - focalY * (ratio - 1),
      });
      setZoomTarget(newZoom);
    },
    [containerRef, viewportRef, setPanClamped],
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

  const zoomIn = useCallback(() => nudgeZoom(1), [nudgeZoom]);
  const zoomOut = useCallback(() => nudgeZoom(-1), [nudgeZoom]);

  const reset = useCallback(() => {
    setZoomTarget(1);
    zoomSmoothRef.current = 1;
    setZoomSmooth(1);
    clearPan();
    applyContentTransform();
  }, [clearPan, applyContentTransform]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const target = zoomTarget;
      const current = zoomSmoothRef.current;
      const diff = target - current;
      if (Math.abs(diff) < ZOOM_SNAP_EPSILON) {
        if (current !== target) {
          zoomSmoothRef.current = target;
          applyContentTransform();
          setZoomSmooth(target);
        }
        return;
      }
      const next = current + diff * ZOOM_SMOOTH_FACTOR;
      zoomSmoothRef.current = next;
      applyContentTransform();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [zoomTarget, applyContentTransform]);

  useLayoutEffect(() => {
    applyContentTransform();
  }, [pan, layout.autoFitScale, applyContentTransform]);

  const layoutSig = layoutSignature(layout);

  useEffect(() => {
    if (panMode) return;
    finishPanDrag();
  }, [panMode, finishPanDrag]);

  useEffect(() => {
    if (!suspendPan) return;
    finishPanDrag();
  }, [suspendPan, finishPanDrag]);

  const isPointerInsideViewport = useCallback(
    (clientX: number, clientY: number) => {
      const viewport = viewportRef?.current;
      if (!viewport) return true;
      const rect = viewport.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    },
    [viewportRef],
  );

  useEffect(() => {
    if (panPointerId === null) return;

    const activePointerId = panPointerId;

    const onDocumentPointerMove = (e: PointerEvent) => {
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

      if (!isPointerInsideViewport(e.clientX, e.clientY)) {
        finishPanDrag(activePointerId);
        return;
      }

      setPanClamped(
        {
          x: drag.panX + dx,
          y: drag.panY + dy,
        },
        { syncState: false },
      );
    };

    const onDocumentPointerEnd = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      finishPanDrag(activePointerId);
    };

    const onWindowBlur = () => {
      finishPanDrag(activePointerId);
    };

    document.addEventListener("pointermove", onDocumentPointerMove);
    document.addEventListener("pointerup", onDocumentPointerEnd);
    document.addEventListener("pointercancel", onDocumentPointerEnd);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("pointermove", onDocumentPointerMove);
      document.removeEventListener("pointerup", onDocumentPointerEnd);
      document.removeEventListener("pointercancel", onDocumentPointerEnd);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [
    panPointerId,
    finishPanDrag,
    isPointerInsideViewport,
    setPanClamped,
  ]);

  useEffect(() => {
    clampPanInBounds();
  }, [zoomTarget, layoutSig, clampPanInBounds]);

  useEffect(() => {
    const container = viewportRef?.current ?? containerRef?.current;
    const content = contentRef?.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      clampPanInBounds();
    });
    observer.observe(container);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [containerRef, viewportRef, contentRef, clampPanInBounds]);

  useEffect(() => {
    const el = zoomSurfaceRef?.current ?? viewportRef?.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (!shouldApplyCanvasWheelZoom(e, el)) return;
      e.preventDefault();
      e.stopPropagation();
      const factor = Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY);
      applyZoomAtPoint(factor, e.clientX, e.clientY);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomSurfaceRef, viewportRef, applyZoomAtPoint]);

  useEffect(() => {
    const el = zoomSurfaceRef?.current ?? viewportRef?.current ?? containerRef?.current;
    if (!el) return;

    let pinchDistance = 0;
    let pinchStartZoom = 1;
    let pinchCenterX = 0;
    let pinchCenterY = 0;

    const touchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const touchCenter = (touches: TouchList) => {
      if (touches.length < 2) return { x: 0, y: 0 };
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinchDistance = touchDistance(e.touches);
      pinchStartZoom = zoomSmoothRef.current;
      const c = touchCenter(e.touches);
      pinchCenterX = c.x;
      pinchCenterY = c.y;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchDistance <= 0) return;
      e.preventDefault();
      const dist = touchDistance(e.touches);
      const targetZoom = clampZoom(pinchStartZoom * (dist / pinchDistance));
      const currentZoom = zoomSmoothRef.current;
      if (Math.abs(targetZoom - currentZoom) < ZOOM_SNAP_EPSILON) return;
      const scale = targetZoom / currentZoom;
      const viewport = viewportRef?.current ?? containerRef?.current;
      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const focalX = pinchCenterX - rect.left - rect.width / 2;
        const focalY = pinchCenterY - rect.top - rect.height / 2;
        setPanClamped({
          x: panRef.current.x - focalX * (scale - 1),
          y: panRef.current.y - focalY * (scale - 1),
        });
      }
      setZoomTarget(targetZoom);
    };

    const onTouchEnd = () => {
      pinchDistance = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [containerRef, viewportRef, zoomSurfaceRef, applyZoomAtPoint]);

  const onPanPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!panMode || suspendPan || e.button !== 0) return;
      if (!shouldStartCanvasPan(e.target)) return;
      finishPanDrag();
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
        armed: false,
        pointerId: e.pointerId,
      };
      setPanPointerId(e.pointerId);
    },
    [panMode, suspendPan, finishPanDrag],
  );

  const onPanPointerMove = useCallback((_e: ReactPointerEvent<HTMLDivElement>) => {
    /* Document-level listener handles pan moves while a session is active. */
  }, []);

  const endPanDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      finishPanDrag(e.pointerId);
    },
    [finishPanDrag],
  );

  const viewScale = layout.autoFitScale * zoomSmooth;

  return {
    zoom: zoomTarget,
    zoomSmooth,
    viewScale,
    pan,
    isPanning,
    panMode,
    zoomIn,
    zoomOut,
    reset,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp: endPanDrag,
    onPanPointerCancel: endPanDrag,
    zoomMin: STRAND_ZOOM_MIN,
    zoomMax: STRAND_ZOOM_MAX,
  };
}
