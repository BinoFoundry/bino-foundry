import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PolygonEditor } from "@/render/mask/PolygonEditor";
import { EditorTool } from "@/render/mask/editor-interaction";
import { defaultLensSet, type LensPolygon } from "@/render/mask/mask-types";

const FRAME_LENS_TABS = defaultLensSet();
import { loadImage } from "@/render/engine/canvas/lens-compositor";

export interface PolygonEditorShellProps {
  imageUrl: string;
  /** Initial path set (e.g. one crop lens or left/right mask lenses). */
  getInitialLenses: () => LensPolygon[];
  /** Called whenever anchors change. */
  onLensesChange: (lenses: LensPolygon[], meta: { imgW: number; imgH: number; valid: boolean }) => void;
  /** Optional mask/crop preview rasterization to thumbnail canvas. */
  renderPreview?: (lenses: LensPolygon[], imgW: number, imgH: number, thumb: HTMLCanvasElement) => void;
  /** Show left/right lens tabs (frame mask). Off for single-path bead crop. */
  showLensTabs?: boolean;
  /** Label for the single path when showLensTabs is false. */
  singlePathLabel?: string;
  previewLabel?: string;
  handlesLabel?: string;
  helpText?: string;
  className?: string;
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
  /** Small raster thumbnail below the canvas (off for admin clip editors). */
  showThumbnailPreview?: boolean;
}

/**
 * Reusable polygon/curve editor stage (pan, zoom, draw, select, curve handles).
 * Shared by frame mask and bead crop editors.
 */
export function PolygonEditorShell({
  imageUrl,
  getInitialLenses,
  onLensesChange,
  renderPreview,
  showLensTabs = true,
  singlePathLabel = "Crop path",
  previewLabel = "Mask preview",
  handlesLabel = "Curve handles",
  helpText = "Draw: click to add points · Shift+click edge to insert · Select (V) then Del to remove · Undo ⌘Z / Redo ⇧⌘Z · Pan (H) or Space · scroll to zoom · C toggles curve",
  className,
  headerExtra,
  footerExtra,
  showThumbnailPreview = true,
}: PolygonEditorShellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<PolygonEditor | null>(null);
  const onLensesChangeRef = useRef(onLensesChange);
  onLensesChangeRef.current = onLensesChange;
  const getInitialLensesRef = useRef(getInitialLenses);
  getInitialLensesRef.current = getInitialLenses;

  const [tool, setTool] = useState<string>(EditorTool.DRAW);
  const [activeLens, setActiveLens] = useState(0);
  const [lensSummaries, setLensSummaries] = useState<{ id: string; label: string; count: number }[]>([]);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [editorReady, setEditorReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistory = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setCanUndo(editor.canUndo());
    setCanRedo(editor.canRedo());
  }, []);
  const syncHistoryRef = useRef(syncHistory);
  syncHistoryRef.current = syncHistory;

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const imgW = editor.imgW;
    const imgH = editor.imgH;
    const lenses = editor.getLenses();
    const valid = lenses.some((l) => l.points.length >= 3);
    setReady(valid);
    setStatus(valid ? "Path ready" : "Add at least 3 points to close the crop boundary");
    setLensSummaries(
      lenses.map((l) => ({ id: l.id, label: l.label, count: l.points.length })),
    );
    onLensesChangeRef.current(lenses, { imgW, imgH, valid });

    const thumb = thumbRef.current;
    if (thumb && renderPreview && imgW > 0 && imgH > 0) {
      renderPreview(lenses, imgW, imgH, thumb);
    }
    syncHistory();
  }, [renderPreview, syncHistory]);
  const emitChangeRef = useRef(emitChange);
  emitChangeRef.current = emitChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

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
        const image = await loadImage(imageUrl);
        if (destroyed) return;

        editor = new PolygonEditor(canvas, image, getInitialLensesRef.current(), {
          tool: EditorTool.DRAW,
          onChange: () => emitChangeRef.current(),
          onToolChange: (t) => setTool(t),
          onHistoryChange: () => syncHistoryRef.current(),
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
        console.error("Polygon editor failed to load image", err);
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
  }, [imageUrl]);

  const runEditor = (fn: (e: PolygonEditor) => void) => {
    const editor = editorRef.current;
    if (!editor) return;
    fn(editor);
    emitChange();
  };

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-card/50 p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-label text-muted-foreground">Tool</span>
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
        {showLensTabs ? (
          <>
            <span className="mx-1 text-border">|</span>
            <span className="type-label text-muted-foreground">Lens</span>
            {FRAME_LENS_TABS.map((tab, i) => {
              const count = lensSummaries.find((s) => s.id === tab.id)?.count ?? 0;
              return (
                <Button
                  key={tab.id}
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
                  {tab.label} ({count})
                </Button>
              );
            })}
          </>
        ) : (
          <span className="ml-2 text-xs text-muted-foreground">
            {singlePathLabel}:{" "}
            {lensSummaries.find((s) => s.id === "crop")?.count ??
              lensSummaries[0]?.count ??
              0}{" "}
            points
          </span>
        )}
        {headerExtra}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!editorReady || !canUndo}
          onClick={() => runEditor((e) => e.undo())}
        >
          Undo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!editorReady || !canRedo}
          onClick={() => runEditor((e) => e.redo())}
        >
          Redo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!editorReady}
          onClick={() => {
            if (window.confirm("Clear all points for this path?")) runEditor((e) => e.clearActiveLens());
          }}
        >
          Clear path
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
          {previewLabel}
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
          {handlesLabel}
        </label>
      </div>

      <p className="text-xs text-muted-foreground">{helpText}</p>

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
        <p className={cn("text-xs", ready ? "text-status-success" : "text-status-warning")}>{status}</p>
        {renderPreview && showThumbnailPreview ? (
          <canvas ref={thumbRef} width={200} height={80} className="surface-canvas rounded border border-subtle" />
        ) : null}
        {footerExtra}
      </div>
    </div>
  );
}
