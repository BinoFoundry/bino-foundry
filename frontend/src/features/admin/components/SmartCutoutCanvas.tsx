import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Eraser,
  Hand,
  MousePointer2,
  Paintbrush,
  Plus,
  RotateCcw,
  ScanSearch,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { CutoutDetectSettingsFields } from "@/features/admin/components/CutoutDetectSettingsFields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { loadImage } from "@/render/engine/canvas/lens-compositor";
import {
  applyCursorCenteredZoom,
  applyPanOffset,
  fitViewportToScreen,
  formatZoomPercent,
  resetViewportToDefault,
  SmoothCursorZoom,
} from "@/render/mask/canvas-viewport";
import type { LensPolygon, PathAnchor } from "@/render/mask/mask-types";
import {
  DEFAULT_SMART_CUTOUT_PARAMS,
  clampCutoutDetectSettings,
  detectSmartCutout,
  finalizeSmartMask,
  getCutoutDetectSettings,
  parseSmartCutoutNotes,
  rasterizeAnchorsToMask,
  rebuildCoreFromSeeds,
  removeAreaAtPoint,
  type CutoutDetectSettings,
  type SmartCutoutDetectResult,
  type SmartCutoutParams,
  type SmartCutoutResult,
  type SmartCutoutSeed,
} from "@/render/mask/smart-cutout-detect";

type CanvasTool = "detect" | "add" | "remove" | "brush" | "pan" | "zoom";

export interface SmartCutoutCanvasProps {
  imageUrl: string;
  className?: string;
  /**
   * When set, Smart mode continues editing this cutout (hybrid with Manual Polygon).
   * Geometry is rasterized into the working mask on load.
   */
  initialPolygon?: LensPolygon | null;
  /**
   * Detection settings owned by the active cutout (or a new-cutout draft).
   * Never share one object across multiple cutouts.
   */
  detectSettings: CutoutDetectSettings;
  /** Persist setting changes onto the active cutout / draft only. */
  onDetectSettingsChange: (next: CutoutDetectSettings) => void;
  /** When false, parent Details panel owns the sliders (still controlled via props). */
  showDetectSettings?: boolean;
  onPreviewChange?: (result: SmartCutoutDetectResult | null) => void;
  onConfirm?: (result: SmartCutoutResult) => void;
  onSwitchToManual?: (result: SmartCutoutResult) => void;
}

/**
 * Admin-only Smart Auto Detect stage.
 * Detection never runs in the live builder — only saved geometry is consumed there.
 */
export function SmartCutoutCanvas({
  imageUrl,
  className,
  initialPolygon = null,
  detectSettings,
  onDetectSettingsChange,
  showDetectSettings = true,
  onPreviewChange,
  onConfirm,
  onSwitchToManual,
}: SmartCutoutCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, imgW: 1, imgH: 1 });
  const spaceDownRef = useRef(false);
  const panRef = useRef<{
    startClient: { x: number; y: number };
    startOffset: { x: number; y: number };
  } | null>(null);
  const smoothZoomRef = useRef<SmoothCursorZoom | null>(null);
  const zoomLabelSyncAtRef = useRef(0);
  const toolRef = useRef<CanvasTool>("detect");
  const drawRafRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewMaskRef = useRef<Uint8Array | null>(null);
  const previewSizeRef = useRef({ w: 0, h: 0 });
  const coreMaskRef = useRef<Uint8Array | null>(null);
  const seedsRef = useRef<SmartCutoutSeed[]>([]);
  const brushMaskRef = useRef<Uint8Array | null>(null);
  const brushingRef = useRef(false);
  const paramsRef = useRef<SmartCutoutParams>({
    ...DEFAULT_SMART_CUTOUT_PARAMS,
    ...clampCutoutDetectSettings(detectSettings),
  });
  const suppressParamRedetectRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("detect");
  const [zoomLabel, setZoomLabel] = useState("100%");
  const [brushRadius, setBrushRadius] = useState(8);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<SmartCutoutDetectResult | null>(null);
  const [busy, setBusy] = useState(false);

  toolRef.current = tool;
  paramsRef.current = {
    ...DEFAULT_SMART_CUTOUT_PARAMS,
    ...clampCutoutDetectSettings(detectSettings),
  };

  const scheduleDraw = useCallback(() => {
    if (drawRafRef.current) return;
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = 0;
      drawRef.current();
    });
  }, []);

  const syncZoomLabel = useCallback((force = false) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!force && now - zoomLabelSyncAtRef.current < 80) return;
    zoomLabelSyncAtRef.current = now;
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
    viewRef.current = { ...fitViewportToScreen(rect.width, rect.height, imgW, imgH), imgW, imgH };
    syncZoomLabel(true);
    scheduleDraw();
  }, [scheduleDraw, syncZoomLabel]);

  const resetView = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    smoothZoomRef.current?.cancel();
    const rect = canvas.getBoundingClientRect();
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    viewRef.current = {
      ...resetViewportToDefault(rect.width, rect.height, imgW, imgH),
      imgW,
      imgH,
    };
    syncZoomLabel(true);
    scheduleDraw();
  }, [scheduleDraw, syncZoomLabel]);

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

  const ensureBrushMask = useCallback(() => {
    const data = imageDataRef.current;
    if (!data) return null;
    if (!brushMaskRef.current || brushMaskRef.current.length !== data.width * data.height) {
      brushMaskRef.current = new Uint8Array(data.width * data.height);
    }
    return brushMaskRef.current;
  }, []);

  const paintBrushAt = useCallback(
    (imgX: number, imgY: number) => {
      const data = imageDataRef.current;
      const mask = ensureBrushMask();
      if (!data || !mask) return;
      const r = Math.max(1, brushRadius);
      const x0 = Math.max(0, Math.floor(imgX - r));
      const y0 = Math.max(0, Math.floor(imgY - r));
      const x1 = Math.min(data.width - 1, Math.ceil(imgX + r));
      const y1 = Math.min(data.height - 1, Math.ceil(imgY + r));
      const r2 = r * r;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - imgX;
          const dy = y - imgY;
          if (dx * dx + dy * dy <= r2) mask[y * data.width + x] = 1;
        }
      }
      scheduleDraw();
    },
    [brushRadius, ensureBrushMask, scheduleDraw],
  );

  const publishResult = useCallback(
    (result: SmartCutoutDetectResult) => {
      setPreview(result);
      onPreviewChange?.(result);
      if (result.ok) {
        coreMaskRef.current = result.coreMask;
        seedsRef.current = result.seeds;
        previewMaskRef.current = result.mask;
        previewSizeRef.current = { w: result.width, h: result.height };
        const islands = 1 + result.regions.length;
        setStatus(
          `${result.areaPx} px · ${result.points.length} pts` +
            (islands > 1 ? ` · ${islands} areas` : ""),
        );
      } else {
        setStatus(result.reason);
      }
      scheduleDraw();
    },
    [onPreviewChange, scheduleDraw],
  );

  const refineFromCore = useCallback(() => {
    const imageData = imageDataRef.current;
    const core = coreMaskRef.current;
    if (!imageData || !core) return;
    const result = finalizeSmartMask(
      core,
      imageData.width,
      imageData.height,
      paramsRef.current,
      seedsRef.current,
    );
    publishResult(result);
  }, [publishResult]);

  const redetectFromSeeds = useCallback(() => {
    const imageData = imageDataRef.current;
    if (!imageData || !seedsRef.current.length) {
      refineFromCore();
      return;
    }
    setBusy(true);
    try {
      const rebuilt = rebuildCoreFromSeeds(imageData, seedsRef.current, paramsRef.current);
      if (!rebuilt) {
        publishResult({ ok: false, reason: "Could not re-detect from saved seeds." });
        return;
      }
      coreMaskRef.current = rebuilt.mask;
      seedsRef.current = rebuilt.seeds;
      const result = finalizeSmartMask(
        rebuilt.mask,
        imageData.width,
        imageData.height,
        paramsRef.current,
        rebuilt.seeds,
      );
      publishResult(result);
    } finally {
      setBusy(false);
    }
  }, [publishResult, refineFromCore]);

  const runDetect = useCallback(
    (opts: {
      seed?: SmartCutoutSeed;
      brushHint?: Uint8Array | null;
      merge: boolean;
    }) => {
      const imageData = imageDataRef.current;
      if (!imageData) return;
      setBusy(true);
      try {
        const result = detectSmartCutout({
          imageData,
          seed: opts.seed,
          brushHint: opts.brushHint,
          existingCore: opts.merge ? coreMaskRef.current : null,
          existingSeeds: opts.merge ? seedsRef.current : [],
          params: paramsRef.current,
        });
        if (!opts.merge && result.ok) {
          // Fresh cutout replaces session.
        }
        publishResult(result);
      } finally {
        setBusy(false);
      }
    },
    [publishResult],
  );

  const clearPreview = useCallback(() => {
    setPreview(null);
    onPreviewChange?.(null);
    previewMaskRef.current = null;
    coreMaskRef.current = null;
    seedsRef.current = [];
    brushMaskRef.current = null;
    setStatus(null);
    scheduleDraw();
  }, [onPreviewChange, scheduleDraw]);

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

    const paintMaskTint = (
      mask: Uint8Array,
      r: number,
      g: number,
      b: number,
      a: number,
    ) => {
      const tint = document.createElement("canvas");
      tint.width = imgW;
      tint.height = imgH;
      const tctx = tint.getContext("2d");
      if (!tctx) return;
      const overlay = tctx.createImageData(imgW, imgH);
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        const o = i * 4;
        overlay.data[o] = r;
        overlay.data[o + 1] = g;
        overlay.data[o + 2] = b;
        overlay.data[o + 3] = a;
      }
      tctx.putImageData(overlay, 0, 0);
      ctx.drawImage(tint, 0, 0);
    };

    const brush = brushMaskRef.current;
    if (brush && brushingRef.current) {
      paintMaskTint(brush, 56, 189, 248, 90);
    }

    const mask = previewMaskRef.current;
    const mw = previewSizeRef.current.w;
    const mh = previewSizeRef.current.h;
    if (mask && mw === imgW && mh === imgH) {
      paintMaskTint(mask, 250, 204, 21, 110);
    }

    ctx.restore();
  }, []);

  drawRef.current = draw;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    clearPreview();
    bgCanvasRef.current = null;
    imageDataRef.current = null;

    void (async () => {
      try {
        const img = await loadImage(imageUrl);
        if (cancelled) return;
        imageRef.current = img;
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const ctx = off.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        imageDataRef.current = ctx.getImageData(0, 0, w, h);

        // Hydrate from existing polygon (hybrid Smart ↔ Manual).
        // Detection settings come from the parent (per-cutout) — do not copy from another cutout.
        if (initialPolygon && (initialPolygon.points?.length ?? 0) >= 3) {
          const parsed = parseSmartCutoutNotes(initialPolygon.notes);
          const meta = parsed.meta;
          const extra: PathAnchor[][] = (meta?.regions ?? []).map((ring) =>
            ring.map((p) => ({
              x: p.x,
              y: p.y,
              curved: false,
              handleIn: null,
              handleOut: null,
            })),
          );
          const core = rasterizeAnchorsToMask(initialPolygon.points ?? [], w, h, extra);
          coreMaskRef.current = core;
          const seedsNorm = meta?.seedsNorm?.length
            ? meta.seedsNorm
            : meta?.seedNorm
              ? [meta.seedNorm]
              : [{ x: 0.5, y: 0.5 }];
          seedsRef.current = seedsNorm.map((s) => ({
            x: s.x * Math.max(1, w - 1),
            y: s.y * Math.max(1, h - 1),
          }));
          suppressParamRedetectRef.current = true;
          const settings = getCutoutDetectSettings(initialPolygon);
          const result = finalizeSmartMask(
            core,
            w,
            h,
            { ...DEFAULT_SMART_CUTOUT_PARAMS, ...settings },
            seedsRef.current,
          );
          publishResult(result);
          queueMicrotask(() => {
            suppressParamRedetectRef.current = false;
          });
        }

        setReady(true);
        requestAnimationFrame(() => {
          fitToView();
          scheduleDraw();
        });
      } catch {
        if (!cancelled) setStatus("Could not load plate image.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per plate / polygon id
  }, [imageUrl, initialPolygon?.id]);

  // Live refine from this cutout's expand / shrink / feather / smooth (no re-detect).
  useEffect(() => {
    if (suppressParamRedetectRef.current) return;
    if (!coreMaskRef.current) return;
    refineFromCore();
  }, [
    detectSettings.expand,
    detectSettings.shrink,
    detectSettings.feather,
    detectSettings.smoothEdge,
    refineFromCore,
  ]);

  // Tolerance re-grows from this cutout's seeds only.
  useEffect(() => {
    if (suppressParamRedetectRef.current) return;
    if (!seedsRef.current.length) return;
    redetectFromSeeds();
  }, [detectSettings.tolerance, redetectFromSeeds]);

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
   * Native non-passive wheel — matches Polygon / Transform editors (scroll to zoom, not click).
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;
      smoothZoomRef.current?.handleWheel(event, canvas.getBoundingClientRect());
    };

    stage.addEventListener("wheel", onWheelNative, { passive: false, capture: true });
    return () => {
      stage.removeEventListener("wheel", onWheelNative, { capture: true });
    };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      fitToView();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToView]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = true;
        e.preventDefault();
      }
      if (e.key === "v" || e.key === "V") setTool("detect");
      if (e.key === "a" || e.key === "A") setTool("add");
      if (e.key === "r" || e.key === "R") setTool("remove");
      if (e.key === "b" || e.key === "B") setTool("brush");
      if (e.key === "h" || e.key === "H") setTool("pan");
      if (e.key === "z" || e.key === "Z") {
        if (!(e.metaKey || e.ctrlKey)) setTool("zoom");
      }
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
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready || busy) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const activeTool = spaceDownRef.current ? "pan" : toolRef.current;
    if (activeTool === "pan" || e.button === 1) {
      panRef.current = {
        startClient: { x: e.clientX, y: e.clientY },
        startOffset: { x: viewRef.current.offsetX, y: viewRef.current.offsetY },
      };
      return;
    }

    if (activeTool === "zoom") {
      return;
    }

    const img = clientToImage(e.clientX, e.clientY);
    if (activeTool === "brush") {
      ensureBrushMask()?.fill(0);
      brushingRef.current = true;
      paintBrushAt(img.x, img.y);
      return;
    }

    if (activeTool === "remove") {
      const core = coreMaskRef.current;
      const imageData = imageDataRef.current;
      if (!core || !imageData) {
        setStatus("Detect a region first.");
        return;
      }
      setBusy(true);
      try {
        const result = removeAreaAtPoint({
          coreMask: core,
          width: imageData.width,
          height: imageData.height,
          x: img.x,
          y: img.y,
          seeds: seedsRef.current,
          params: paramsRef.current,
        });
        publishResult(result);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (activeTool === "add") {
      if (!coreMaskRef.current) {
        setStatus("Detect a first region before Add Area.");
        setTool("detect");
        return;
      }
      runDetect({ seed: img, merge: true });
      return;
    }

    // Fresh detect (replaces session) or first click
    runDetect({ seed: img, merge: Boolean(coreMaskRef.current) && tool === "detect" ? false : false });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (panRef.current) {
      const next = applyPanOffset(
        panRef.current.startOffset,
        panRef.current.startClient,
        e.clientX,
        e.clientY,
      );
      viewRef.current = {
        ...viewRef.current,
        offsetX: next.offsetX,
        offsetY: next.offsetY,
      };
      scheduleDraw();
      return;
    }
    if (brushingRef.current) {
      const img = clientToImage(e.clientX, e.clientY);
      paintBrushAt(img.x, img.y);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    panRef.current = null;
    if (brushingRef.current) {
      brushingRef.current = false;
      const hint = brushMaskRef.current?.slice() ?? null;
      const merge = Boolean(coreMaskRef.current) && toolRef.current === "add";
      runDetect({ brushHint: hint, merge });
    }
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const previewOk = preview?.ok === true ? preview : null;

  const cursorClass =
    tool === "pan"
      ? "cursor-grab"
      : tool === "zoom"
        ? "cursor-zoom-in"
        : tool === "brush" || tool === "detect" || tool === "add" || tool === "remove"
          ? "cursor-crosshair"
          : "cursor-default";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={tool === "detect" ? "default" : "outline"}
          className="h-7"
          onClick={() => setTool("detect")}
          title="Click to detect (V) — starts / replaces selection"
        >
          <MousePointer2 className="mr-1 h-3.5 w-3.5" />
          Detect
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "add" ? "default" : "outline"}
          className="h-7"
          disabled={!previewOk}
          onClick={() => setTool("add")}
          title="Add Area (A) — merge another detail into this cutout"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Area
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "remove" ? "default" : "outline"}
          className="h-7"
          disabled={!previewOk}
          onClick={() => setTool("remove")}
          title="Remove Area (R) — click an unwanted region"
        >
          <Eraser className="mr-1 h-3.5 w-3.5" />
          Remove Area
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "brush" ? "default" : "outline"}
          className="h-7"
          onClick={() => setTool("brush")}
          title="Brush hint (B)"
        >
          <Paintbrush className="mr-1 h-3.5 w-3.5" />
          Brush
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "pan" ? "default" : "outline"}
          className="h-7"
          onClick={() => setTool("pan")}
          title="Pan (H / Space)"
        >
          <Hand className="mr-1 h-3.5 w-3.5" />
          Pan
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "zoom" ? "default" : "outline"}
          className="h-7"
          onClick={() => setTool("zoom")}
          title="Zoom — scroll wheel on canvas (Z)"
        >
          <Search className="h-3.5 w-3.5" />
          Zoom
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2"
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
          className="h-7 px-2"
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
          className="h-7"
          onClick={() => {
            fitToView();
            scheduleDraw();
          }}
        >
          <ScanSearch className="h-3.5 w-3.5" />
          Fit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => {
            resetView();
            scheduleDraw();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {showDetectSettings ? (
        <CutoutDetectSettingsFields
          settings={clampCutoutDetectSettings(detectSettings)}
          onChange={onDetectSettingsChange}
          caption="Settings belong to this cutout only — other cutouts keep their own values."
        />
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Detection settings for this cutout are in the Details panel above.
        </p>
      )}

      {tool === "brush" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Brush size</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{brushRadius}px</span>
          </div>
          <input
            type="range"
            min={3}
            max={28}
            step={1}
            value={brushRadius}
            onChange={(e) => setBrushRadius(Number(e.target.value))}
            className="w-full accent-foreground"
          />
        </div>
      ) : null}

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
          className={cn("h-full w-full touch-none outline-none", cursorClass)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerEnter={() => {
            if (tool === "zoom" || tool === "pan") {
              canvasRef.current?.focus({ preventScroll: true });
            }
          }}
        />
        {!ready ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Loading plate…
          </p>
        ) : null}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Scroll or Ctrl+scroll to zoom · Pan (H) or Space+drag · Fit / Reset match other frame editors
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {busy
            ? "Detecting…"
            : status ??
              "Click a rivet/screw/logo. Use Add Area for more pieces in the same cutout."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={clearPreview}>
            Clear
          </Button>
          {onSwitchToManual ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              disabled={!previewOk}
              onClick={() => previewOk && onSwitchToManual(previewOk)}
            >
              Manual Polygon
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-7"
            disabled={!previewOk}
            onClick={() => previewOk && onConfirm?.(previewOk)}
          >
            Apply cutout
          </Button>
        </div>
      </div>
    </div>
  );
}
