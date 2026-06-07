import { useEffect, useMemo, useState } from "react";
import { Eye, Glasses } from "lucide-react";

import { SunglassesCompositor } from "@/render/components/SunglassesCompositor";
import { buildCustomiserCompositorConfig } from "@/render/adapters/customiser-config";
import { isFrameViewClipReady } from "@/render/lens-clip";
import { lensTintEntryToGradient } from "@/render/tint/lens-tint-spec";
import { TintRenderPreview } from "@/render/tint/TintRenderPreview";
import { useCatalogue } from "@/state/catalogue";
import type { FrameEntry } from "@/data/glasses";
import type { FrameViewAxis } from "@/types/frame-rendering";
import type { LensTintEntry } from "@/types/sunglasses-catalog";

import { cn } from "@/lib/utils";

const PREVIEW_VIEWS: FrameViewAxis[] = ["front", "side", "three_quarter"];

function framesWithClipReady(frames: FrameEntry[]): FrameEntry[] {
  return frames.filter((frame) =>
    frame.renderViews?.some((v) => v.plateUrl && isFrameViewClipReady(v)),
  );
}

function availableViews(frame: FrameEntry): FrameViewAxis[] {
  return PREVIEW_VIEWS.filter((axis) => {
    const view = frame.renderViews?.find((v) => v.view === axis);
    return view?.plateUrl && isFrameViewClipReady(view);
  });
}

interface TintEditorLivePreviewProps {
  form: LensTintEntry;
}

export function TintEditorLivePreview({ form }: TintEditorLivePreviewProps) {
  const { frames } = useCatalogue();
  const previewFrames = useMemo(() => framesWithClipReady(frames), [frames]);
  const [frameId, setFrameId] = useState<string>("");
  const [view, setView] = useState<FrameViewAxis>("front");
  const [showCompare, setShowCompare] = useState(false);

  const selectedFrame = previewFrames.find((f) => f.id === frameId) ?? previewFrames[0];
  const views = selectedFrame ? availableViews(selectedFrame) : [];

  useEffect(() => {
    if (!previewFrames.length) return;
    if (!frameId || !previewFrames.some((f) => f.id === frameId)) {
      setFrameId(previewFrames[0].id);
    }
  }, [previewFrames, frameId]);

  useEffect(() => {
    if (views.length && !views.includes(view)) {
      setView(views[0]);
    }
  }, [views, view]);

  const tintGradient = useMemo(() => lensTintEntryToGradient(form), [form]);

  const compositorConfig = useMemo(() => {
    if (!selectedFrame) return null;
    return buildCustomiserCompositorConfig({
      frameSku: {
        id: selectedFrame.id,
        name: selectedFrame.name,
        price: selectedFrame.price,
        renderViews: selectedFrame.renderViews,
      },
      tint: tintGradient,
      options: {},
    });
  }, [selectedFrame, tintGradient]);

  const clearLensConfig = useMemo(() => {
    if (!selectedFrame || !showCompare) return null;
    return buildCustomiserCompositorConfig({
      frameSku: {
        id: selectedFrame.id,
        name: selectedFrame.name,
        price: selectedFrame.price,
        renderViews: selectedFrame.renderViews,
      },
      tint: {
        ...tintGradient,
        top: "#E8D59E",
        bottom: "#D9BBB0",
        category: "classic",
        opacity: 0.08,
      },
      options: {},
    });
  }, [selectedFrame, showCompare, tintGradient]);

  const usesRealCompositor = compositorConfig?.renderMode === "svg-clip";

  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="type-body flex items-center gap-1.5 font-medium text-foreground">
            <Glasses className="h-4 w-4 text-primary" />
            Live product preview
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Same renderer as the customer customiser — updates as you adjust colors and opacity.
          </p>
        </div>
        {usesRealCompositor ? (
          <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showCompare}
              onChange={(e) => setShowCompare(e.target.checked)}
              className="rounded"
            />
            Compare
          </label>
        ) : null}
      </div>

      {previewFrames.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <select
            className="min-w-0 flex-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs"
            value={selectedFrame?.id ?? ""}
            onChange={(e) => setFrameId(e.target.value)}
            aria-label="Preview frame"
          >
            {previewFrames.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {views.length > 1 ? (
            <div className="flex rounded-md border border-border p-0.5">
              {views.map((axis) => (
                <button
                  key={axis}
                  type="button"
                  onClick={() => setView(axis)}
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-medium capitalize",
                    view === axis ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {axis === "three_quarter" ? "45°" : axis}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {usesRealCompositor && compositorConfig ? (
        <div
          className={cn(
            "grid gap-3",
            showCompare && clearLensConfig ? "sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {showCompare && clearLensConfig ? (
            <div className="space-y-1">
              <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Bare lenses
              </p>
              <div className="compositor-surface overflow-hidden rounded-lg">
                <SunglassesCompositor
                  config={clearLensConfig}
                  view={view}
                  aspectRatio="16/10"
                  label="Without tint"
                  allowSvgFallback={false}
                  className="w-full"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-1">
            {showCompare ? (
              <p className="text-center text-[10px] font-medium uppercase tracking-wide text-primary">
                This tint
              </p>
            ) : (
              <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                <Eye className="h-3 w-3" />
                Customer view
              </p>
            )}
            <div className="compositor-surface overflow-hidden rounded-lg ring-1 ring-primary/15">
              <SunglassesCompositor
                config={compositorConfig}
                view={view}
                aspectRatio="16/10"
                label={form.name || "Tint preview"}
                allowSvgFallback={false}
                className="w-full"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <TintRenderPreview entry={form} className="h-32 w-full rounded-lg border border-border" />
          <p className="rounded-lg border border-status-warning bg-status-warning px-3 py-2 text-[11px]">
            Upload a frame plate and configure SVG lens clips (Frames admin) to preview on real product
            photography.
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
        <div>
          <dt className="inline">Opacity </dt>
          <dd className="inline font-mono text-foreground">{form.opacity.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="inline">Style </dt>
          <dd className="inline capitalize text-foreground">{form.category}</dd>
        </div>
        {!usesRealCompositor ? null : (
          <>
            <div className="col-span-2">
              <dt className="inline">Frame </dt>
              <dd className="inline text-foreground">{selectedFrame?.name}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
