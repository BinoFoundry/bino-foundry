import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, MousePointer2, RotateCcw, Search, ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadImage } from "@/render/engine/canvas/lens-compositor";
import { drawLensPath, hitTestPathEdge, traceLensPath } from "@/render/mask/bezier-path";
import {
  SmoothCursorZoom,
  applyPanOffset,
  fitViewportToScreen,
  formatZoomPercent,
  resetViewportToDefault,
} from "@/render/mask/canvas-viewport";
import { migrateAnchors, type LensPolygon, type PathAnchor } from "@/render/mask/mask-types";
import {
  applySnapToLensEdge,
  pathBounds,
  rotateAnchors,
  scaleAnchors,
  translateAnchors,
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
  bounds: ReturnType<typeof pathBounds>;
  startAngle: number;
};

type CanvasTool = "select" | "pan" | "zoom";

export interface FramePartTransformCanvasProps {
  imageUrl: string;
  parts: LensPolygon[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onCommitPoints: (index: number, points: PathAnchor[]) => void;
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
  onSelect,
  onCommitPoints,
  onEnterVertexEdit,
  snapToLensEdge = false,
  lensOpenings,
  className,
}: FramePartTransformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const dragRef = useRef<DragState | null>(null);
  const previewPointsRef = useRef<PathAnchor[] | null>(null);
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, imgW: 1, imgH: 1 });
  const spaceDownRef = useRef(false);
  const panRef = useRef<{
    startClient: { x: number; y: number };
    startOffset: { x: number; y: number };
  } | null>(null);
  const smoothZoomRef = useRef<SmoothCursorZoom | null>(null);

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [status, setStatus] = useState("Select tool active · click a detail to select and edit");
  const [zoomLabel, setZoomLabel] = useState("100%");

  const setToolAndStatus = useCallback((next: CanvasTool) => {
    dragRef.current = null;
    previewPointsRef.current = null;
    panRef.current = null;
    setTool(next);
    setStatus(
      next === "pan"
        ? "Pan tool active · drag the canvas"
        : next === "zoom"
          ? "Zoom tool active · use the mouse wheel to zoom"
          : "Select tool active · click a detail to select and edit",
    );
  }, []);

  const syncZoomLabel = useCallback(() => {
    setZoomLabel(formatZoomPercent(viewRef.current.scale));
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
    syncZoomLabel();
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
    syncZoomLabel();
  }, [syncZoomLabel]);

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
    ctx.drawImage(image, 0, 0, imgW, imgH);

    const list = partsRef.current;
    const active = activeIndexRef.current;
    const lw = 2 / scale;

    list.forEach((part, index) => {
      if (part.visible === false) return;
      const points =
        index === active && previewPointsRef.current
          ? previewPointsRef.current
          : part.points ?? [];
      if ((points?.length ?? 0) < 2) return;
      const isActive = index === active;
      drawLensPath(ctx, { ...part, points }, imgW, imgH, {
        fill: isActive ? "rgba(37, 99, 235, 0.28)" : "rgba(15, 23, 42, 0.18)",
        stroke: isActive ? "#2563eb" : "rgba(255,255,255,0.55)",
        lineWidth: isActive ? lw * 1.4 : lw,
        showHandles: false,
        active: isActive,
      });
    });

    const activePart = list[active];
    const activePoints =
      previewPointsRef.current ??
      (activePart ? migrateAnchors(activePart.points ?? []) : []);
    if (activePart && activePart.visible !== false && activePoints.length >= 2) {
      drawTransformHandles(ctx, activePoints, imgW, imgH, scale);
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    let destroyed = false;
    setReady(false);
    void loadImage(imageUrl)
      .then((image) => {
        if (destroyed) return;
        imageRef.current = image;
        fitToView();
        setReady(true);
        draw();
      })
      .catch(() => {
        if (!destroyed) setStatus("Failed to load plate image");
      });
    return () => {
      destroyed = true;
    };
  }, [imageUrl, fitToView, draw]);

  useEffect(() => {
    previewPointsRef.current = null;
    draw();
  }, [parts, activeIndex, draw]);

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
        draw();
        syncZoomLabel();
      },
    });
    smoothZoomRef.current = zoom;
    return () => {
      zoom.destroy();
      smoothZoomRef.current = null;
    };
  }, [draw, syncZoomLabel]);

  const hitPartIndex = (imgX: number, imgY: number): number => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const { imgW, imgH, scale } = viewRef.current;
    if (!ctx) return -1;
    const threshold = 10 / scale;
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
      if (hitTestPathEdge(imgX, imgY, points, imgW, imgH, threshold) >= 0) {
        return index;
      }
      if (points.length >= 3) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        traceLensPath(ctx, { ...part, points }, imgW, imgH, true);
        const inside = ctx.isPointInPath(imgX, imgY);
        ctx.restore();
        if (inside) return index;
      }
    }
    return -1;
  };

  const hitHandle = (imgX: number, imgY: number): HandleKind | null => {
    const active = partsRef.current[activeIndexRef.current];
    if (!active || active.visible === false) return null;
    const points = previewPointsRef.current ?? migrateAnchors(active.points ?? []);
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

  const commitPreview = (index: number) => {
    const points = previewPointsRef.current;
    if (!points) return;
    const snapped = applySnapToLensEdge(points, {
      enabled: snapToLensEdge,
      lensOpenings,
    });
    previewPointsRef.current = null;
    onCommitPoints(index, snapped);
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
      setStatus("Panning…");
      return;
    }

    if (tool === "zoom") {
      setStatus("Zoom tool active · use the mouse wheel to zoom");
      return;
    }

    if (spaceDownRef.current || e.altKey) {
      setStatus("Select tool active · click a detail to select and edit");
      return;
    }
    if (e.button !== 0) return;

    const img = clientToImage(e.clientX, e.clientY);
    const handle = hitHandle(img.x, img.y);
    if (handle) {
      const active = partsRef.current[activeIndexRef.current];
      if (!active) return;
      const startPoints = migrateAnchors(active.points ?? []);
      const bounds = pathBounds(startPoints);
      dragRef.current = {
        kind: handle,
        startClient: { x: e.clientX, y: e.clientY },
        startImg: img,
        startPoints,
        bounds,
        startAngle: Math.atan2(img.y - bounds.cy * viewRef.current.imgH, img.x - bounds.cx * viewRef.current.imgW),
      };
      previewPointsRef.current = startPoints;
      setStatus(handle === "rotate" ? "Rotating…" : handle === "move" ? "Moving…" : "Scaling…");
      return;
    }

    const hit = hitPartIndex(img.x, img.y);
    if (hit >= 0) {
      onSelect(hit);
      const part = partsRef.current[hit];
      if (!part) return;
      const startPoints = migrateAnchors(part.points ?? []);
      const bounds = pathBounds(startPoints);
      dragRef.current = {
        kind: "move",
        startClient: { x: e.clientX, y: e.clientY },
        startImg: img,
        startPoints,
        bounds,
        startAngle: 0,
      };
      previewPointsRef.current = startPoints;
      activeIndexRef.current = hit;
      setStatus("Moving…");
      draw();
      return;
    }

    setStatus("Select tool active · click a detail to select and edit");
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
      draw();
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

    let next = drag.startPoints;
    if (drag.kind === "move") {
      next = translateAnchors(drag.startPoints, dxNorm, dyNorm);
    } else if (drag.kind === "rotate") {
      const angle = Math.atan2(img.y - b.cy * imgH, img.x - b.cx * imgW);
      next = rotateAnchors(drag.startPoints, angle - drag.startAngle, b.cx, b.cy);
    } else {
      next = scaleFromHandle(drag.startPoints, b, drag.kind, img.x / imgW, img.y / imgH);
    }
    previewPointsRef.current = next;
    draw();
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
      setStatus(tool === "pan" ? "Pan tool active · drag the canvas" : status);
      return;
    }
    if (dragRef.current) {
      const index = activeIndexRef.current;
      dragRef.current = null;
      commitPreview(index);
      setStatus("Double-click to edit vertices · Esc exits vertex mode");
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

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (tool !== "zoom") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    smoothZoomRef.current?.handleWheel(e.nativeEvent, canvas.getBoundingClientRect());
  };

  const cursorClass =
    tool === "pan"
      ? panRef.current
        ? "cursor-grabbing"
        : "cursor-grab"
      : tool === "zoom"
        ? "cursor-zoom-in"
        : "cursor-default";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{status}</p>
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
      </div>
      <div
        className="relative w-full overflow-hidden rounded-lg border border-border bg-[#1a1a1e]"
        style={{ height: "min(52vh, 520px)", minHeight: 360 }}
      >
        <canvas
          ref={canvasRef}
          className={cn("h-full w-full touch-none", cursorClass)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Select edits details · Pan drags the canvas · Zoom uses the mouse wheel · Fit and Reset do
        not change the active tool
      </p>
    </div>
  );
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
