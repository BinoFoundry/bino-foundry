import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PolygonEditor } from "@/render/mask/PolygonEditor";
import { EditorTool } from "@/render/mask/editor-interaction";
import {
  createMaskConfig,
  defaultLensSet,
  isMaskConfigValid,
  pathsToMaskCanvas,
  type LensPolygon,
  type MaskConfig,
} from "@/render/mask";
import { loadImage } from "@/render/engine/canvas/lens-compositor";

interface FrameMaskEditorProps {
  plateUrl: string;
  width: number;
  height: number;
  initialMask?: MaskConfig | null;
  onChange?: (config: MaskConfig | null, valid: boolean) => void;
  className?: string;
}

/** Inline polygon mask editor (bino-rendering editor workflow). */
export function FrameMaskEditor({
  plateUrl,
  initialMask,
  onChange,
  className,
}: FrameMaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<PolygonEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialMaskRef = useRef(initialMask);
  initialMaskRef.current = initialMask;

  const [tool, setTool] = useState<string>(EditorTool.DRAW);
  const [activeLens, setActiveLens] = useState(0);
  const [lensSummaries, setLensSummaries] = useState<{ id: string; label: string; count: number }[]>([
    { id: "left", label: "Left lens", count: 0 },
    { id: "right", label: "Right lens", count: 0 },
  ]);
  const [status, setStatus] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [ready, setReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const imgW = editor.imgW;
    const imgH = editor.imgH;
    const config = createMaskConfig(imgW, imgH, editor.getLenses());
    const valid = isMaskConfigValid(config);
    setReady(valid);
    setStatus(
      valid
        ? "Mask ready — lenses will tint inside polygons"
        : "Add at least 3 points per lens polygon",
    );
    setLensSummaries(
      editor.getLenses().map((l) => ({ id: l.id, label: l.label, count: l.points.length })),
    );
    onChangeRef.current?.(valid ? config : null, valid);

    const thumb = thumbRef.current;
    if (thumb && imgW > 0 && imgH > 0) {
      const mask = pathsToMaskCanvas(imgW, imgH, config.lenses);
      const ctx = thumb.getContext("2d");
      if (ctx) {
        const scale = Math.min(thumb.width / imgW, thumb.height / imgH);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, thumb.width, thumb.height);
        ctx.drawImage(mask, 0, 0, imgW, imgH, 0, 0, imgW * scale, imgH * scale);
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plateUrl) return;

    let destroyed = false;
    let editor: PolygonEditor | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let layoutRaf = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const runLayout = (fit = false) => {
      if (destroyed || !editor) return;
      editor.resize();
      if (fit) editor.fitToView();
      else editor.draw();
    };

    const scheduleLayout = (fit = false) => {
      if (layoutRaf) cancelAnimationFrame(layoutRaf);
      layoutRaf = requestAnimationFrame(() => {
        layoutRaf = 0;
        runLayout(fit);
      });
    };

    const onWindowResize = () => scheduleLayout(false);

    const onStageResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => scheduleLayout(false), 120);
    };

    void (async () => {
      setEditorReady(false);
      try {
        const image = await loadImage(plateUrl);
        if (destroyed) return;

        const lenses: LensPolygon[] =
          initialMaskRef.current?.lenses?.length
            ? initialMaskRef.current.lenses
            : defaultLensSet();

        editor = new PolygonEditor(canvas, image, lenses, {
          tool: EditorTool.DRAW,
          onChange: emitChange,
          onToolChange: (t) => setTool(t),
        });
        editorRef.current = editor;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            runLayout(true);
            emitChange();
            if (!destroyed) setEditorReady(true);
          });
        });

        const stage = canvas.parentElement;
        if (stage && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(onStageResize);
          resizeObserver.observe(stage);
        }
        window.addEventListener("resize", onWindowResize);
      } catch (err) {
        console.error("Mask editor failed to load plate", err);
        setStatus("Failed to load image — check URL / CORS");
      }
    })();

    return () => {
      destroyed = true;
      setEditorReady(false);
      if (layoutRaf) cancelAnimationFrame(layoutRaf);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onWindowResize);
      resizeObserver?.disconnect();
      editor?.destroy();
      editorRef.current = null;
    };
  }, [plateUrl, emitChange]);

  const runEditor = (fn: (e: PolygonEditor) => void) => {
    const editor = editorRef.current;
    if (!editor) return;
    fn(editor);
    emitChange();
  };

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-card/50 p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tool</span>
        {(
          [
            [EditorTool.DRAW, "Draw (P)"],
            [EditorTool.SELECT, "Select (V)"],
            [EditorTool.NAVIGATE, "Pan (H)"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tool === id ? "default" : "outline"}
            disabled={!editorReady}
            onClick={() => runEditor((e) => e.setTool(id))}
          >
            {label}
          </Button>
        ))}
        <span className="mx-1 text-border">|</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lens</span>
        {lensSummaries.map((lens, i) => (
          <Button
            key={lens.id}
            type="button"
            size="sm"
            variant={activeLens === i ? "default" : "outline"}
            disabled={!editorReady}
            onClick={() =>
              runEditor((e) => {
                e.setActiveLens(i);
                setActiveLens(i);
              })
            }
          >
            {lens.label} ({lens.count})
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!editorReady}
          onClick={() => runEditor((e) => e.undoLastPoint())}
        >
          Undo point
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!editorReady}
          onClick={() => {
            if (window.confirm("Clear all points for this lens?")) runEditor((e) => e.clearActiveLens());
          }}
        >
          Clear lens
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!editorReady}
          onClick={() => runEditor((e) => e.fitToView())}
        >
          Fit view
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!editorReady}
          onClick={() => {
            const editor = editorRef.current;
            if (editor && editor.selectedPointIndex >= 0) {
              editor.toggleSegmentAt(editor.selectedPointIndex);
              emitChange();
            }
          }}
        >
          Toggle curve (C)
        </Button>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={showPreview}
            disabled={!editorReady}
            onChange={(e) => {
              setShowPreview(e.target.checked);
              runEditor((ed) => {
                ed.showPreview = e.target.checked;
                ed.draw();
              });
            }}
          />
          Mask preview
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={showHandles}
            disabled={!editorReady}
            onChange={(e) => {
              setShowHandles(e.target.checked);
              runEditor((ed) => {
                ed.showHandles = e.target.checked;
                ed.draw();
              });
            }}
          />
          Curve handles
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Draw: click on the image to add anchors · Select · Pan (H) or Space · scroll to zoom · Del removes
        · C toggles curve
      </p>

      <div
        className="relative w-full overflow-hidden rounded-lg border border-border bg-muted/30"
        style={{ height: "min(52vh, 520px)", minHeight: 360 }}
      >
        <canvas
          ref={canvasRef}
          data-fill-stage="true"
          className="absolute inset-0 block h-full w-full touch-none"
        />
        {!editorReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            Loading editor…
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className={cn("text-xs", ready ? "text-emerald-600" : "text-amber-600")}>{status}</p>
        <canvas ref={thumbRef} width={200} height={80} className="rounded border border-border bg-white" />
      </div>
    </div>
  );
}
