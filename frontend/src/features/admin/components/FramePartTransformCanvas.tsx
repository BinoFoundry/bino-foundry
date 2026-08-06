import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, MousePointer2, RotateCcw, Search, ScanSearch, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadImage } from "@/render/engine/canvas/lens-compositor";
import { drawLensPath, hitTestPathEdge, traceLensPath } from "@/render/mask/bezier-path";
import {
  SmoothCursorZoom,
  applyCursorCenteredZoom,
  applyPanOffset,
  fitViewportToScreen,
  formatZoomPercent,
  resetViewportToDefault,
} from "@/render/mask/canvas-viewport";
import { migrateAnchors, type LensPolygon, type PathAnchor } from "@/render/mask/mask-types";
import {
  applySnapToLensEdge,
  getSubpathPoints,
  pathBounds,
  rotateAnchors,
  scaleAnchors,
  translateAnchors,
  type FramePartSubpath,
} from "@/features/admin/lib/frame-parts";

type HandleKind =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "rotate";

type DragState = {
  kind: HandleKind;
  startClient: { x: number; y: number };
  startImg: { x: number; y: number };
  startPoints: PathAnchor[];
  /** When transforming the outer path, companion holes move/scale/rotate with it. */
  startHolePoints: PathAnchor[][];
  /** Transform-clean baseline for Reset Shape (same transform as live points). */
  startBaseline: PathAnchor[] | null;
  startHoleBaselines: Array<PathAnchor[] | null>;
  bounds: ReturnType<typeof pathBounds>;
  startAngle: number;
  transformGroup: boolean;
};

type CanvasTool = "select" | "pan" | "zoom";

export interface FramePartTransformCanvasProps {
  imageUrl: string;
  parts: LensPolygon[];
  activeIndex: number;
  /** Outer polygon or cutout index within the active Manual Detail. */
  activeSubpath?: FramePartSubpath;
  onSelect: (index: number) => void;
  onSelectSubpath?: (subpath: FramePartSubpath) => void;
  onCommitGeometry: (
    index: number,
    geometry: {
      points: PathAnchor[];
      holes: LensPolygon[];
      shapeBaseline?: PathAnchor[];
    },
  ) => void;
  onEnterVertexEdit: (index: number) => void;
  /**
   * Reserved: when true, transforms will snap to lens openings via applySnapToLensEdge.
   * Not implemented yet — kept for architecture.
   */
  snapToLensEdge?: boolean;
  lensOpenings?: LensPolygon[];
  className?: string;
}

/**
 * Figma-style transform stage for Manual Details:
 * click to select · drag to move · handles to scale/rotate · double-click for vertices.
 */
export function FramePartTransformCanvas({
  imageUrl,
  parts,
  activeIndex,
  activeSubpath = "outer",
  onSelect,
  onSelectSubpath,
  onCommitGeometry,
  onEnterVertexEdit,
  snapToLensEdge = false,
  lensOpenings,
  className,
}: FramePartTransformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const activeSubpathRef = useRef<FramePartSubpath>(activeSubpath);
  activeSubpathRef.current = activeSubpath;
  const dragRef = useRef<DragState | null>(null);
  const previewPointsRef = useRef<PathAnchor[] | null>(null);
  const previewHolePointsRef = useRef<PathAnchor[][] | null>(null);
  const previewBaselineRef = useRef<PathAnchor[] | null>(null);
  const previewHoleBaselinesRef = useRef<Array<PathAnchor[] | null> | null>(null);
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, imgW: 1, imgH: 1 });
  const spaceDownRef = useRef(false);
  const panRef = useRef<{
    startClient: { x: number; y: number };
    startOffset: { x: number; y: number };
  } | null>(null);
  const smoothZoomRef = useRef<SmoothCursorZoom | null>(null);
  const toolRef = useRef<CanvasTool>("select");
  const drawRafRef = useRef(0);
  const zoomLabelSyncAtRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const migratedPartsRef = useRef<Array<{ outer: PathAnchor[]; holes: PathAnchor[][] }>>([]);

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("select");
  /** Gesture feedback — rendered as a canvas overlay so the toolbar never shifts. */
  const [gestureStatus, setGestureStatus] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState("100%");
  toolRef.current = tool;

  const setToolAndStatus = useCallback((next: CanvasTool) => {
    dragRef.current = null;
    previewPointsRef.current = null;
    previewHolePointsRef.current = null;
    previewBaselineRef.current = null;
    previewHoleBaselinesRef.current = null;
    panRef.current = null;
    setGestureStatus(null);
    setTool(next);
    toolRef.current = next;
    // Zoom/Pan should become the active interaction target immediately.
    if (next === "zoom" || next === "pan") {
      requestAnimationFrame(() => {
        canvasRef.current?.focus({ preventScroll: true });
      });
    }
  }, []);

  const syncZoomLabel = useCallback((force = false) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!force && now - zoomLabelSyncAtRef.current < 80) return;
    zoomLabelSyncAtRef.current = now;
    setZoomLabel(formatZoomPercent(viewRef.current.scale));
  }, []);

  const scheduleDraw = useCallback(() => {
    if (drawRafRef.current) return;
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = 0;
      drawRef.current();
    });
  }, []);

  const fitToView = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    smoothZoomRef.current?.cancel();
    const rect = canvas.getBoundingClientRect();
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    const next = fitViewportToScreen(rect.width, rect.height, imgW, imgH);
    viewRef.current = { ...next, imgW, imgH };
    syncZoomLabel(true);
  }, [syncZoomLabel]);

  const resetView = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    smoothZoomRef.current?.cancel();
    const rect = canvas.getBoundingClientRect();
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    const next = resetViewportToDefault(rect.width, rect.height, imgW, imgH);
    viewRef.current = { ...next, imgW, imgH };
    syncZoomLabel(true);
  }, [syncZoomLabel]);

  const nudgeZoom = useCallback(
    (direction: 1 | -1) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      smoothZoomRef.current?.cancel();
      const rect = canvas.getBoundingClientRect();
      const factor = direction > 0 ? 1.25 : 1 / 1.25;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const next = applyCursorCenteredZoom(
        viewRef.current,
        viewRef.current.scale * factor,
        cx,
        cy,
      );
      viewRef.current = { ...viewRef.current, ...next };
      syncZoomLabel(true);
      scheduleDraw();
    },
    [scheduleDraw, syncZoomLabel],
  );

  const clientToImage = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = viewRef.current;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !image || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(0, 0, cssW, cssH);

    const { scale, offsetX, offsetY, imgW, imgH } = viewRef.current;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    let bg = bgCanvasRef.current;
    if (!bg || bg.width !== imgW || bg.height !== imgH) {
      bg = document.createElement("canvas");
      bg.width = imgW;
      bg.height = imgH;
      const bctx = bg.getContext("2d");
      if (bctx) bctx.drawImage(image, 0, 0, imgW, imgH);
      bgCanvasRef.current = bg;
    }
    ctx.drawImage(bg, 0, 0, imgW, imgH);

    const list = partsRef.current;
    const cached = migratedPartsRef.current;
    const active = activeIndexRef.current;
    const lw = 2 / scale;

    list.forEach((part, index) => {
      if (part.visible === false) return;
      const isActive = index === active;
      const cachedPart = cached[index];
      const outerPoints =
        isActive && activeSubpathRef.current === "outer" && previewPointsRef.current
          ? previewPointsRef.current
          : (cachedPart?.outer ?? migrateAnchors(part.points ?? []));
      if (outerPoints.length < 2) return;

      const holePointsList =
        isActive && previewHolePointsRef.current
          ? previewHolePointsRef.current
          : isActive && activeSubpathRef.current !== "outer" && previewPointsRef.current
            ? (cachedPart?.holes ?? []).map((holePts, hi) =>
                hi === activeSubpathRef.current ? previewPointsRef.current! : holePts,
              )
            : (cachedPart?.holes ??
              (part.holes ?? []).map((hole) => migrateAnchors(hole.points ?? [])));

      drawCompoundPart(ctx, outerPoints, holePointsList, imgW, imgH, {
        fill: isActive ? "rgba(37, 99, 235, 0.28)" : "rgba(15, 23, 42, 0.18)",
        stroke: isActive ? "#2563eb" : "rgba(255,255,255,0.55)",
        holeStroke: isActive ? "#f97316" : "rgba(255,255,255,0.35)",
        lineWidth: isActive ? lw * 1.4 : lw,
        emphasizeHoleIndex:
          isActive && activeSubpathRef.current !== "outer" ? activeSubpathRef.current : null,
      });
    });

    const activePart = list[active];
    const editPoints =
      previewPointsRef.current ??
      (activePart ? getSubpathPoints(activePart, activeSubpathRef.current) : []);
    if (activePart && activePart.visible !== false && editPoints.length >= 2) {
      drawTransformHandles(ctx, editPoints, imgW, imgH, scale);
    }

    ctx.restore();
  }, []);
  drawRef.current = draw;

  useEffect(() => {
    let destroyed = false;
    setReady(false);
    bgCanvasRef.current = null;
    void loadImage(imageUrl)
      .then((image) => {
        if (destroyed) return;
        imageRef.current = image;
        bgCanvasRef.current = null;
        fitToView();
        setReady(true);
        draw();
      })
      .catch(() => {
        if (!destroyed) setReady(false);
      });
    return () => {
      destroyed = true;
      if (drawRafRef.current) {
        cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = 0;
      }
    };
  }, [imageUrl, fitToView, draw]);

  useEffect(() => {
    migratedPartsRef.current = parts.map((part) => ({
      outer: migrateAnchors(part.points ?? []),
      holes: (part.holes ?? []).map((hole) => migrateAnchors(hole.points ?? [])),
    }));
    previewPointsRef.current = null;
    previewHolePointsRef.current = null;
    draw();
  }, [parts, activeIndex, activeSubpath, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onResize = () => {
      fitToView();
      draw();
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", onResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [fitToView, draw]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      spaceDownRef.current = true;
      if (tool !== "select") e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [tool]);

  useEffect(() => {
    const zoom = new SmoothCursorZoom({
      getState: () => {
        const v = viewRef.current;
        return { scale: v.scale, offsetX: v.offsetX, offsetY: v.offsetY };
      },
      setState: (next) => {
        viewRef.current.scale = next.scale;
        viewRef.current.offsetX = next.offsetX;
        viewRef.current.offsetY = next.offsetY;
      },
      onFrame: () => {
        scheduleDraw();
        syncZoomLabel();
      },
    });
    smoothZoomRef.current = zoom;
    return () => {
      zoom.destroy();
      smoothZoomRef.current = null;
    };
  }, [scheduleDraw, syncZoomLabel]);

  /**
   * Native non-passive wheel listener — React's onWheel is passive, so preventDefault
   * cannot stop browser scroll / Ctrl+wheel page zoom.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheelNative = (event: WheelEvent) => {
      const activeTool = toolRef.current;
      // Select: leave page scrolling alone.
      if (activeTool === "select") return;

      // Pan / Zoom: canvas owns the wheel while the pointer is over the stage.
      event.preventDefault();
      event.stopPropagation();

      if (activeTool !== "zoom") return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      smoothZoomRef.current?.handleWheel(event, canvas.getBoundingClientRect());
    };

    stage.addEventListener("wheel", onWheelNative, { passive: false, capture: true });
    return () => {
      stage.removeEventListener("wheel", onWheelNative, { capture: true });
    };
  }, []);

  const hitSubpathOnPart = (part: LensPolygon, imgX: number, imgY: number): FramePartSubpath => {
    const { imgW, imgH, scale } = viewRef.current;
    const threshold = 12 / scale;
    const ctx = canvasRef.current?.getContext("2d");
    const holes = part.holes ?? [];

    for (let hi = holes.length - 1; hi >= 0; hi--) {
      const holePts = migrateAnchors(holes[hi]?.points ?? []);
      if (holePts.length >= 2 && hitTestPathEdge(imgX, imgY, holePts, imgW, imgH, threshold)) {
        return hi;
      }
    }

    if (ctx) {
      for (let hi = holes.length - 1; hi >= 0; hi--) {
        const hole = holes[hi];
        const holePts = migrateAnchors(hole?.points ?? []);
        if (holePts.length < 3) continue;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        traceLensPath(
          ctx,
          { id: hole?.id ?? `cutout-${hi}`, label: hole?.label ?? "", points: holePts },
          imgW,
          imgH,
          true,
        );
        const insideHole = ctx.isPointInPath(imgX, imgY);
        ctx.restore();
        if (insideHole) return hi;
      }
    }

    const points = migrateAnchors(part.points ?? []);
    if (points.length >= 2 && hitTestPathEdge(imgX, imgY, points, imgW, imgH, threshold)) {
      return "outer";
    }
    return "outer";
  };

  const hitPartIndex = (imgX: number, imgY: number): number => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const { imgW, imgH, scale } = viewRef.current;
    if (!ctx) return -1;
    const threshold = 12 / scale;
    // Prefer active, then top-most (later in list).
    const order = [
      activeIndexRef.current,
      ...partsRef.current.map((_, i) => i).reverse(),
    ].filter((i, idx, arr) => i >= 0 && arr.indexOf(i) === idx);

    for (const index of order) {
      const part = partsRef.current[index];
      if (!part || part.visible === false) continue;
      const points = migrateAnchors(part.points ?? []);
      if (points.length < 2) continue;
      if (hitTestPathEdge(imgX, imgY, points, imgW, imgH, threshold)) {
        return index;
      }
      for (const hole of part.holes ?? []) {
        const holePts = migrateAnchors(hole.points ?? []);
        if (holePts.length >= 2 && hitTestPathEdge(imgX, imgY, holePts, imgW, imgH, threshold)) {
          return index;
        }
        if (holePts.length >= 3) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.beginPath();
          traceLensPath(
            ctx,
            { id: hole.id, label: hole.label, points: holePts },
            imgW,
            imgH,
            true,
          );
          const insideHole = ctx.isPointInPath(imgX, imgY);
          ctx.restore();
          if (insideHole) return index;
        }
      }
      if (points.length >= 3) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        traceLensPath(ctx, { ...part, points }, imgW, imgH, true);
        for (const hole of part.holes ?? []) {
          const holePts = migrateAnchors(hole.points ?? []);
          if (holePts.length >= 3) {
            traceLensPath(ctx, { id: hole.id, label: hole.label, points: holePts }, imgW, imgH, true);
          }
        }
        const inside = ctx.isPointInPath(imgX, imgY, "evenodd");
        ctx.restore();
        if (inside) return index;
      }
    }
    return -1;
  };

  const hitHandle = (imgX: number, imgY: number): HandleKind | null => {
    const active = partsRef.current[activeIndexRef.current];
    if (!active || active.visible === false) return null;
    const points =
      previewPointsRef.current ?? getSubpathPoints(active, activeSubpathRef.current);
    if (points.length < 2) return null;
    const { imgW, imgH, scale } = viewRef.current;
    const b = pathBounds(points);
    const handles = transformHandlePositions(b, imgW, imgH);
    const r = 8 / scale;
    for (const [kind, pos] of Object.entries(handles) as [HandleKind, { x: number; y: number }][]) {
      if (Math.hypot(imgX - pos.x, imgY - pos.y) <= r) return kind;
    }
    // Body hit → move
    if (hitPartIndex(imgX, imgY) === activeIndexRef.current) return "move";
    return null;
  };

  const beginTransformDrag = (
    handle: HandleKind,
    img: { x: number; y: number },
    part: LensPolygon,
  ) => {
    const subpath = activeSubpathRef.current;
    const startPoints = getSubpathPoints(part, subpath);
    const bounds = pathBounds(startPoints);
    const transformGroup = subpath === "outer";
    const startHolePoints = transformGroup
      ? (part.holes ?? []).map((hole) => migrateAnchors(hole.points ?? []))
      : [];
    const startBaseline =
      subpath === "outer"
        ? migrateAnchors(part.shapeBaseline ?? part.points ?? [])
        : migrateAnchors(
            part.holes?.[subpath]?.shapeBaseline ?? part.holes?.[subpath]?.points ?? [],
          );
    const startHoleBaselines = transformGroup
      ? (part.holes ?? []).map((hole) =>
          hole.shapeBaseline?.length
            ? migrateAnchors(hole.shapeBaseline)
            : migrateAnchors(hole.points ?? []),
        )
      : [];
    dragRef.current = {
      kind: handle,
      startClient: { x: 0, y: 0 },
      startImg: img,
      startPoints,
      startHolePoints,
      startBaseline: startBaseline.length ? startBaseline : null,
      startHoleBaselines,
      bounds,
      startAngle: Math.atan2(
        img.y - bounds.cy * viewRef.current.imgH,
        img.x - bounds.cx * viewRef.current.imgW,
      ),
      transformGroup,
    };
    previewPointsRef.current = startPoints;
    previewHolePointsRef.current = transformGroup ? startHolePoints : null;
    previewBaselineRef.current = startBaseline.length ? startBaseline : null;
    previewHoleBaselinesRef.current = transformGroup ? startHoleBaselines : null;
  };

  const commitPreview = (index: number) => {
    const points = previewPointsRef.current;
    if (!points) return;
    const snapped = applySnapToLensEdge(points, {
      enabled: snapToLensEdge,
      lensOpenings,
    });
    const part = partsRef.current[index];
    if (!part) {
      previewPointsRef.current = null;
      previewHolePointsRef.current = null;
      previewBaselineRef.current = null;
      previewHoleBaselinesRef.current = null;
      return;
    }
    const subpath = activeSubpathRef.current;
    const baselinePreview = previewBaselineRef.current;
    if (subpath === "outer") {
      const holePts = previewHolePointsRef.current;
      const holeBaselines = previewHoleBaselinesRef.current;
      const holes = (part.holes ?? []).map((hole, hi) => ({
        ...hole,
        points: applySnapToLensEdge(holePts?.[hi] ?? hole.points ?? [], {
          enabled: snapToLensEdge,
          lensOpenings,
        }),
        shapeBaseline: holeBaselines?.[hi]?.length
          ? migrateAnchors(holeBaselines[hi]!)
          : hole.shapeBaseline,
      }));
      previewPointsRef.current = null;
      previewHolePointsRef.current = null;
      previewBaselineRef.current = null;
      previewHoleBaselinesRef.current = null;
      onCommitGeometry(index, {
        points: snapped,
        holes,
        shapeBaseline: baselinePreview?.length ? migrateAnchors(baselinePreview) : snapped,
      });
      return;
    }
    const holes = [...(part.holes ?? [])];
    if (holes[subpath]) {
      holes[subpath] = {
        ...holes[subpath]!,
        points: snapped,
        shapeBaseline: baselinePreview?.length ? migrateAnchors(baselinePreview) : snapped,
      };
    }
    previewPointsRef.current = null;
    previewHolePointsRef.current = null;
    previewBaselineRef.current = null;
    previewHoleBaselinesRef.current = null;
    onCommitGeometry(index, {
      points: migrateAnchors(part.points ?? []),
      holes,
      shapeBaseline: part.shapeBaseline,
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    if (tool === "pan" || e.button === 1) {
      e.preventDefault();
      panRef.current = {
        startClient: { x: e.clientX, y: e.clientY },
        startOffset: { x: viewRef.current.offsetX, y: viewRef.current.offsetY },
      };
      setGestureStatus("Panning");
      return;
    }

    if (tool === "zoom") {
      return;
    }

    if (spaceDownRef.current || e.altKey) {
      return;
    }
    if (e.button !== 0) return;

    const img = clientToImage(e.clientX, e.clientY);
    const handle = hitHandle(img.x, img.y);
    if (handle) {
      e.preventDefault();
      const active = partsRef.current[activeIndexRef.current];
      if (!active) return;
      if (handle === "move") {
        const preferred = hitSubpathOnPart(active, img.x, img.y);
        if (preferred !== activeSubpathRef.current) {
          onSelectSubpath?.(preferred);
          activeSubpathRef.current = preferred;
        }
      }
      beginTransformDrag(handle, img, active);
      if (dragRef.current) {
        dragRef.current.startClient = { x: e.clientX, y: e.clientY };
      }
      setGestureStatus(handle === "rotate" ? "Rotating" : handle === "move" ? "Moving" : "Scaling");
      return;
    }

    const hit = hitPartIndex(img.x, img.y);
    if (hit >= 0) {
      e.preventDefault();
      const part = partsRef.current[hit];
      if (!part) return;
      const subpath = hitSubpathOnPart(part, img.x, img.y);
      onSelect(hit);
      onSelectSubpath?.(subpath);
      activeSubpathRef.current = subpath;
      activeIndexRef.current = hit;
      beginTransformDrag("move", img, part);
      if (dragRef.current) {
        dragRef.current.startClient = { x: e.clientX, y: e.clientY };
      }
      setGestureStatus("Moving");
      draw();
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panRef.current) {
      const pan = applyPanOffset(
        panRef.current.startOffset,
        panRef.current.startClient,
        e.clientX,
        e.clientY,
      );
      viewRef.current.offsetX = pan.offsetX;
      viewRef.current.offsetY = pan.offsetY;
      scheduleDraw();
      return;
    }

    if (tool !== "select") return;

    const drag = dragRef.current;
    if (!drag) return;
    const { imgW, imgH } = viewRef.current;
    const img = clientToImage(e.clientX, e.clientY);
    const dxNorm = (img.x - drag.startImg.x) / imgW;
    const dyNorm = (img.y - drag.startImg.y) / imgH;
    const b = drag.bounds;

    const applyTo = (pts: PathAnchor[]) => {
      if (drag.kind === "move") return translateAnchors(pts, dxNorm, dyNorm);
      if (drag.kind === "rotate") {
        const angle = Math.atan2(img.y - b.cy * imgH, img.x - b.cx * imgW);
        return rotateAnchors(pts, angle - drag.startAngle, b.cx, b.cy);
      }
      return scaleFromHandle(pts, b, drag.kind, img.x / imgW, img.y / imgH);
    };

    previewPointsRef.current = applyTo(drag.startPoints);
    if (drag.transformGroup) {
      previewHolePointsRef.current = drag.startHolePoints.map((pts) => applyTo(pts));
      previewHoleBaselinesRef.current = drag.startHoleBaselines.map((pts) =>
        pts ? applyTo(pts) : null,
      );
    } else {
      previewHolePointsRef.current = null;
      previewHoleBaselinesRef.current = null;
    }
    previewBaselineRef.current = drag.startBaseline ? applyTo(drag.startBaseline) : null;
    scheduleDraw();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    try {
      canvas?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (panRef.current) {
      panRef.current = null;
      setGestureStatus(null);
      return;
    }
    if (dragRef.current) {
      const index = activeIndexRef.current;
      dragRef.current = null;
      commitPreview(index);
      setGestureStatus(null);
      draw();
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "select") return;
    const img = clientToImage(e.clientX, e.clientY);
    const hit = hitPartIndex(img.x, img.y);
    if (hit >= 0) {
      onSelect(hit);
      onEnterVertexEdit(hit);
    }
  };

  const cursorClass =
    gestureStatus === "Moving" || gestureStatus === "Scaling" || gestureStatus === "Rotating"
      ? "cursor-move"
      : tool === "pan" || gestureStatus === "Panning"
        ? gestureStatus === "Panning"
          ? "cursor-grabbing"
          : "cursor-grab"
        : tool === "zoom"
          ? "cursor-zoom-in"
          : "cursor-default";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={tool === "select" ? "default" : "outline"}
          onClick={() => setToolAndStatus("select")}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          Select
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "pan" ? "default" : "outline"}
          onClick={() => setToolAndStatus("pan")}
        >
          <Hand className="h-3.5 w-3.5" />
          Pan
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "zoom" ? "default" : "outline"}
          onClick={() => setToolAndStatus("zoom")}
        >
          <Search className="h-3.5 w-3.5" />
          Zoom
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="px-2"
          onClick={() => nudgeZoom(-1)}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="px-2"
          onClick={() => nudgeZoom(1)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <span
          className="rounded border border-border/70 bg-muted/20 px-2 py-1 text-[10px] tabular-nums text-muted-foreground"
          aria-live="polite"
          title="Current zoom"
        >
          {zoomLabel}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            fitToView();
            draw();
          }}
        >
          <ScanSearch className="h-3.5 w-3.5" />
          Fit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            resetView();
            draw();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-lg border border-border bg-[#1a1a1e]"
        style={{
          height: "min(52vh, 520px)",
          minHeight: 360,
          overscrollBehavior: "contain",
          touchAction: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className={cn(
            "h-full w-full touch-none outline-none",
            cursorClass,
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          onPointerEnter={() => {
            if (tool === "zoom" || tool === "pan") {
              canvasRef.current?.focus({ preventScroll: true });
            }
          }}
        />
        {gestureStatus ? (
          <div
            className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/90 shadow-sm"
            aria-live="polite"
          >
            {gestureStatus}
          </div>
        ) : null}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Drag inside a shape to move it · drag handles to scale / rotate · click a cutout edge or
        interior to select it · double-click for vertices · Pan / Zoom leave the selection alone
      </p>
    </div>
  );
}

/** Fill outer − holes with evenodd; stroke outer solid and cutouts dashed. */
function drawCompoundPart(
  ctx: CanvasRenderingContext2D,
  outerPoints: PathAnchor[],
  holePointsList: PathAnchor[][],
  imgW: number,
  imgH: number,
  style: {
    fill: string;
    stroke: string;
    holeStroke: string;
    lineWidth: number;
    emphasizeHoleIndex: number | null;
  },
) {
  const outer = { id: "outer", label: "Outer", points: outerPoints };
  ctx.beginPath();
  traceLensPath(ctx, outer, imgW, imgH, true);
  for (const holePts of holePointsList) {
    if (holePts.length < 3) continue;
    traceLensPath(ctx, { id: "hole", label: "Hole", points: holePts }, imgW, imgH, true);
  }
  if (outerPoints.length >= 3) {
    ctx.fillStyle = style.fill;
    ctx.fill("evenodd");
  }

  drawLensPath(ctx, outer, imgW, imgH, {
    fill: null,
    stroke: style.stroke,
    lineWidth: style.lineWidth,
    showHandles: false,
    active: false,
  });

  holePointsList.forEach((holePts, hi) => {
    if (holePts.length < 2) return;
    const emphasize = style.emphasizeHoleIndex === hi;
    ctx.save();
    ctx.setLineDash(emphasize ? [] : [5 / style.lineWidth, 4 / style.lineWidth]);
    drawLensPath(
      ctx,
      { id: `hole-${hi}`, label: `Cutout ${hi + 1}`, points: holePts },
      imgW,
      imgH,
      {
        fill: null,
        stroke: style.holeStroke,
        lineWidth: emphasize ? style.lineWidth * 1.2 : style.lineWidth * 0.9,
        showHandles: false,
        active: false,
      },
    );
    ctx.restore();
  });
}

function transformHandlePositions(
  b: ReturnType<typeof pathBounds>,
  imgW: number,
  imgH: number,
): Record<Exclude<HandleKind, "move">, { x: number; y: number }> {
  const minX = b.minX * imgW;
  const maxX = b.maxX * imgW;
  const minY = b.minY * imgH;
  const maxY = b.maxY * imgH;
  const cx = b.cx * imgW;
  const cy = b.cy * imgH;
  const rotateY = minY - Math.max(24, (maxY - minY) * 0.15);
  return {
    nw: { x: minX, y: minY },
    n: { x: cx, y: minY },
    ne: { x: maxX, y: minY },
    e: { x: maxX, y: cy },
    se: { x: maxX, y: maxY },
    s: { x: cx, y: maxY },
    sw: { x: minX, y: maxY },
    w: { x: minX, y: cy },
    rotate: { x: cx, y: rotateY },
  };
}

function drawTransformHandles(
  ctx: CanvasRenderingContext2D,
  points: PathAnchor[],
  imgW: number,
  imgH: number,
  scale: number,
) {
  const b = pathBounds(points);
  if (b.width < 1e-6 && b.height < 1e-6) return;
  const minX = b.minX * imgW;
  const maxX = b.maxX * imgW;
  const minY = b.minY * imgH;
  const maxY = b.maxY * imgH;
  const lw = 1.2 / scale;
  const r = 5 / scale;

  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = lw;
  ctx.setLineDash([6 / scale, 4 / scale]);
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
  ctx.setLineDash([]);

  const handles = transformHandlePositions(b, imgW, imgH);
  ctx.beginPath();
  ctx.moveTo(handles.n.x, handles.n.y);
  ctx.lineTo(handles.rotate.x, handles.rotate.y);
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = lw;
  ctx.stroke();

  for (const [kind, pos] of Object.entries(handles)) {
    ctx.beginPath();
    if (kind === "rotate") {
      ctx.arc(pos.x, pos.y, r * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = lw;
      ctx.stroke();
    } else {
      ctx.rect(pos.x - r, pos.y - r, r * 2, r * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function scaleFromHandle(
  startPoints: PathAnchor[],
  b: ReturnType<typeof pathBounds>,
  kind: HandleKind,
  cursorX: number,
  cursorY: number,
): PathAnchor[] {
  let minX = b.minX;
  let maxX = b.maxX;
  let minY = b.minY;
  let maxY = b.maxY;

  if (kind === "e" || kind === "ne" || kind === "se") maxX = cursorX;
  if (kind === "w" || kind === "nw" || kind === "sw") minX = cursorX;
  if (kind === "s" || kind === "se" || kind === "sw") maxY = cursorY;
  if (kind === "n" || kind === "ne" || kind === "nw") minY = cursorY;

  // Keep a minimum size so the part remains editable.
  const minSize = 0.008;
  if (maxX - minX < minSize) {
    if (kind === "e" || kind === "ne" || kind === "se") maxX = minX + minSize;
    else minX = maxX - minSize;
  }
  if (maxY - minY < minSize) {
    if (kind === "s" || kind === "se" || kind === "sw") maxY = minY + minSize;
    else minY = maxY - minSize;
  }

  const sx = b.width > 1e-8 ? (maxX - minX) / b.width : 1;
  const sy = b.height > 1e-8 ? (maxY - minY) / b.height : 1;

  // Anchor the opposite edge/corner while scaling.
  let cx = b.cx;
  let cy = b.cy;
  if (kind === "e" || kind === "ne" || kind === "se") cx = b.minX;
  if (kind === "w" || kind === "nw" || kind === "sw") cx = b.maxX;
  if (kind === "s" || kind === "se" || kind === "sw") cy = b.minY;
  if (kind === "n" || kind === "ne" || kind === "nw") cy = b.maxY;
  if (kind === "n" || kind === "s") cx = b.cx;
  if (kind === "e" || kind === "w") cy = b.cy;

  return scaleAnchors(startPoints, sx, sy, cx, cy);
}
