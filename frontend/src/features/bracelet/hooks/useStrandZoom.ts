import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export const STRAND_ZOOM_MIN = 0.55;
export const STRAND_ZOOM_MAX = 3;
const ZOOM_BUTTON_STEP = 0.08;
const ZOOM_WHEEL_SENSITIVITY = 0.0011;
const ZOOM_SMOOTH_FACTOR = 0.28;
const ZOOM_SNAP_EPSILON = 0.006;
const TWIN_STRAND_GAP_PX = 24;
const STRAND_CHROME_Y_PX = 72;

export interface StrandPan {
  x: number;
  y: number;
}

export interface StrandZoomLayout {
  strandSize: number;
  twinning: boolean;
}

export interface StrandZoomRefs {
  containerRef?: RefObject<HTMLElement | null>;
  viewportRef?: RefObject<HTMLElement | null>;
  contentRef?: RefObject<HTMLElement | null>;
}

function clampZoom(value: number) {
  return Math.max(STRAND_ZOOM_MIN, Math.min(STRAND_ZOOM_MAX, value));
}

function isDefaultZoom(zoom: number) {
  return zoom <= 1 + ZOOM_SNAP_EPSILON;
}

function clampPan(pan: StrandPan, maxX: number, maxY: number): StrandPan {
  return {
    x: maxX > 0 ? Math.min(maxX, Math.max(-maxX, pan.x)) : 0,
    y: maxY > 0 ? Math.min(maxY, Math.max(-maxY, pan.y)) : 0,
  };
}

/** Sum child layout boxes so flex-wrap / twin strands report true width and height. */
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

function expectedContentSize(layout: StrandZoomLayout & { zoom: number }) {
  const render = layout.strandSize * layout.zoom;
  return {
    width: layout.twinning ? render * 2 + TWIN_STRAND_GAP_PX : render,
    height: render + STRAND_CHROME_Y_PX,
  };
}

function computePanBounds(
  container: HTMLElement,
  content: HTMLElement,
  layout: StrandZoomLayout & { zoom: number },
) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const extent = measureContentExtent(content);
  const expected = expectedContentSize(layout);
  const contentW = Math.max(extent.width, expected.width);
  const contentH = Math.max(extent.height, expected.height);
  const zoomSlack = Math.max(0, (layout.zoom - 1) * layout.strandSize * 0.5);

  return {
    maxX: Math.max(0, (contentW - cw) / 2, zoomSlack),
    maxY: Math.max(0, (contentH - ch) / 2, zoomSlack),
  };
}

/** Strand zoom (layout size) + pan offset for inspecting zoomed areas. */
export function useStrandZoom(refs: StrandZoomRefs, layout: StrandZoomLayout, initial = 1) {
  const { containerRef, viewportRef, contentRef } = refs;
  const layoutRef = useRef<StrandZoomLayout & { zoom: number }>({ ...layout, zoom: initial });

  const [zoomTarget, setZoomTarget] = useState(initial);
  const [zoomSmooth, setZoomSmooth] = useState(initial);
  const [pan, setPan] = useState<StrandPan>({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const panBoundsRef = useRef({ maxX: 0, maxY: 0 });
  const isPanningRef = useRef(false);
  const panRef = useRef(pan);
  panRef.current = pan;

  const clearPan = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setPanMode(false);
    setIsPanning(false);
    panDragRef.current = null;
    isPanningRef.current = false;
  }, []);

  const measurePanBounds = useCallback(() => {
    layoutRef.current = { ...layout, zoom: zoomSmoothRef.current };
    const container = viewportRef?.current ?? containerRef?.current;
    const content = contentRef?.current;
    if (!container || !content) {
      panBoundsRef.current = { maxX: 0, maxY: 0 };
      return;
    }
    panBoundsRef.current = computePanBounds(container, content, layoutRef.current);
  }, [containerRef, viewportRef, contentRef, layout]);

  const setPanClamped = useCallback(
    (next: StrandPan) => {
      measurePanBounds();
      const { maxX, maxY } = panBoundsRef.current;
      setPan(clampPan(next, maxX, maxY));
    },
    [measurePanBounds],
  );

  const nudgeZoom = useCallback((direction: 1 | -1) => {
    setZoomTarget((z) => clampZoom(z + direction * ZOOM_BUTTON_STEP));
  }, []);

  const zoomIn = useCallback(() => nudgeZoom(1), [nudgeZoom]);
  const zoomOut = useCallback(() => nudgeZoom(-1), [nudgeZoom]);

  const zoomSmoothRef = useRef(initial);

  const reset = useCallback(() => {
    setZoomTarget(1);
    zoomSmoothRef.current = 1;
    setZoomSmooth(1);
    clearPan();
  }, [clearPan]);

  const togglePanMode = useCallback(() => {
    setPanMode((on) => !on);
    setIsPanning(false);
    isPanningRef.current = false;
    panDragRef.current = null;
  }, []);

  useEffect(() => {
    if (isDefaultZoom(zoomTarget)) {
      zoomSmoothRef.current = 1;
      setZoomSmooth(1);
      setPan({ x: 0, y: 0 });
      setPanMode(false);
      setIsPanning(false);
      panDragRef.current = null;
      isPanningRef.current = false;
    }
  }, [zoomTarget]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const target = zoomTarget;
      const current = zoomSmoothRef.current;
      const diff = target - current;
      if (Math.abs(diff) < ZOOM_SNAP_EPSILON) {
        if (current !== target) {
          zoomSmoothRef.current = target;
          setZoomSmooth(target);
        }
        return;
      }
      const next = current + diff * ZOOM_SMOOTH_FACTOR;
      zoomSmoothRef.current = next;
      setZoomSmooth(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [zoomTarget]);

  useEffect(() => {
    if (isDefaultZoom(zoomTarget)) return;
    measurePanBounds();
    if (!isPanningRef.current) {
      const { maxX, maxY } = panBoundsRef.current;
      setPan((p) => clampPan(p, maxX, maxY));
    }
  }, [zoomTarget, zoomSmooth, layout, measurePanBounds]);

  useEffect(() => {
    const container = viewportRef?.current ?? containerRef?.current;
    const content = contentRef?.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      measurePanBounds();
      if (isPanningRef.current) return;
      const { maxX, maxY } = panBoundsRef.current;
      setPan((p) => clampPan(p, maxX, maxY));
    });
    observer.observe(container);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [containerRef, viewportRef, contentRef, measurePanBounds]);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY);
      setZoomTarget((z) => clampZoom(z * factor));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef]);

  useEffect(() => {
    const el = viewportRef?.current ?? containerRef?.current;
    if (!el) return;

    let pinchDistance = 0;
    let pinchStartZoom = 1;

    const touchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinchDistance = touchDistance(e.touches);
      pinchStartZoom = zoomSmoothRef.current;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchDistance <= 0) return;
      e.preventDefault();
      const dist = touchDistance(e.touches);
      const ratio = dist / pinchDistance;
      setZoomTarget(clampZoom(pinchStartZoom * ratio));
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
  }, [containerRef, viewportRef]);

  const onPanPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!panMode || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      isPanningRef.current = true;
      setIsPanning(true);
    },
    [panMode],
  );

  const onPanPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!panDragRef.current) return;
      const { startX, startY, panX, panY } = panDragRef.current;
      setPanClamped({
        x: panX + (e.clientX - startX),
        y: panY + (e.clientY - startY),
      });
    },
    [setPanClamped],
  );

  const endPanDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panDragRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    panDragRef.current = null;
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  const canPan = zoomTarget > 1 + ZOOM_SNAP_EPSILON;

  return {
    zoom: zoomTarget,
    zoomSmooth,
    pan,
    panMode,
    isPanning,
    canPan,
    zoomIn,
    zoomOut,
    reset,
    togglePanMode,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp: endPanDrag,
    onPanPointerCancel: endPanDrag,
    zoomMin: STRAND_ZOOM_MIN,
    zoomMax: STRAND_ZOOM_MAX,
  };
}
