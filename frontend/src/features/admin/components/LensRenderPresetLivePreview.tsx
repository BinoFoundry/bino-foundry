import { useEffect, useMemo, useState } from "react";

import {
  LENS_RENDER_ZERO_SETTINGS,
  type LensClipRenderSettings,
} from "@bino-foundry/shared/types";

import { TintColorControl } from "@/features/admin/components/tint-editor/TintColorControl";
import { isValidHexColor } from "@/features/admin/lib/adminHex";
import { SunglassesCompositor } from "@/render/components/SunglassesCompositor";
import { buildCustomiserCompositorConfig } from "@/render/adapters/customiser-config";
import { isFrameViewClipReady } from "@/render/lens-clip";
import { useCatalogue } from "@/state/catalogue";
import type { FrameEntry } from "@/data/glasses";
import type { FrameViewAxis } from "@/types/frame-rendering";
import { cn } from "@/lib/utils";

function framesWithClipReady(frames: FrameEntry[]): FrameEntry[] {
  return frames.filter(
    (frame) =>
      frame.renderViews?.some((v) => v.plateUrl && isFrameViewClipReady(v)),
  );
}

interface LensRenderPresetLivePreviewProps {
  draftSettings: LensClipRenderSettings;
  systemDefaults: LensClipRenderSettings;
  previewTintHex: string;
  onPreviewTintChange: (hex: string) => void;
}

/**
 * Live preset preview — exact same SunglassesCompositor / SVG pipeline as customers.
 * There is only one rendering pipeline: "Show original lens" applies the renderer's identity
 * settings, producing the untouched original lens.
 */
export function LensRenderPresetLivePreview({
  draftSettings,
  systemDefaults,
  previewTintHex,
  onPreviewTintChange,
}: LensRenderPresetLivePreviewProps) {
  const { frames } = useCatalogue();
  const previewFrames = useMemo(() => framesWithClipReady(frames), [frames]);
  const [frameId, setFrameId] = useState("");
  const [showOriginalLens, setShowOriginalLens] = useState(false);
  const [splitCompare, setSplitCompare] = useState(false);

  const selectedFrame = previewFrames.find((f) => f.id === frameId) ?? previewFrames[0];

  useEffect(() => {
    if (!previewFrames.length) return;
    if (!frameId || !previewFrames.some((f) => f.id === frameId)) {
      setFrameId(previewFrames[0].id);
    }
  }, [previewFrames, frameId]);

  const tint = useMemo(
    () => ({
      id: "preview-tint",
      name: "Preview",
      top: isValidHexColor(previewTintHex) ? previewTintHex : "#8F1830",
      bottom: isValidHexColor(previewTintHex) ? previewTintHex : "#8F1830",
      category: "classic" as const,
      opacity: 1,
    }),
    [previewTintHex],
  );

  const buildConfig = (settings: LensClipRenderSettings) => {
    if (!selectedFrame) return null;
    return buildCustomiserCompositorConfig({
      frameSku: {
        id: selectedFrame.id,
        name: selectedFrame.name,
        price: selectedFrame.price,
        renderViews: selectedFrame.renderViews,
        lensRenderPresetId: selectedFrame.lensRenderPresetId,
        useLensRenderPreset: selectedFrame.useLensRenderPreset,
      },
      tint,
      options: {},
      lensRenderSystemDefaults: systemDefaults,
      renderSettingsOverride: settings,
    });
  };

  // Preset config uses live draft settings. Original config uses identity calibration and
  // zero additive effects, so the same renderer paints only the untouched source lens.
  const previewConfig = useMemo(
    () => buildConfig(draftSettings),
    [selectedFrame, tint, draftSettings],
  );
  const originalConfig = useMemo(
    () => buildConfig({ ...draftSettings, ...LENS_RENDER_ZERO_SETTINGS }),
    [selectedFrame, tint, draftSettings],
  );
  const activeConfig = showOriginalLens ? originalConfig : previewConfig;

  const views = (["front", "side"] as FrameViewAxis[]).filter((axis) =>
    selectedFrame?.renderViews?.some((v) => v.view === axis && v.plateUrl),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-foreground">Preview frame</span>
          <select
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={selectedFrame?.id ?? ""}
            onChange={(e) => setFrameId(e.target.value)}
            disabled={!previewFrames.length}
          >
            {previewFrames.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <TintColorControl
          id="lens-render-preview-colour"
          label="Preview Lens Colour"
          hint="HEX only (for example #8F1830). Preview-only; catalogue tint colours are unchanged."
          value={previewTintHex}
          onChange={(hex) => onPreviewTintChange(hex.toUpperCase())}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={showOriginalLens}
            onChange={(e) => setShowOriginalLens(e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Show original lens</span>
            <span className="ml-1 text-muted-foreground">
              (uses identity calibration — the untouched original lens)
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={splitCompare}
            onChange={(e) => setSplitCompare(e.target.checked)}
          />
          <span className="font-medium text-foreground">Split: original / preset</span>
        </label>
      </div>

      {!selectedFrame || !activeConfig ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          Add an active frame with a ready lens clip to preview presets.
        </div>
      ) : (
        <div
          className={cn(
            "grid min-h-[320px] flex-1 gap-3 rounded-lg border border-border p-3",
            splitCompare ? "lg:grid-cols-2" : "grid-cols-1",
          )}
        >
          {splitCompare ? (
            <>
              <PreviewPane title="Original lens" config={originalConfig!} views={views} />
              <PreviewPane title="With preset" config={previewConfig!} views={views} />
            </>
          ) : (
            <PreviewPane
              title={showOriginalLens ? "Original lens" : "Live preview"}
              config={activeConfig}
              views={views}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PreviewPane({
  title,
  config,
  views,
}: {
  title: string;
  config: NonNullable<ReturnType<typeof buildCustomiserCompositorConfig>>;
  views: FrameViewAxis[];
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-md p-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/80">{title}</p>
      <div className={cn("grid min-h-0 flex-1 gap-2", views.length > 1 ? "sm:grid-cols-2" : "")}>
        {views.map((axis) => (
          <SunglassesCompositor
            key={`${title}-${axis}`}
            config={config}
            view={axis}
            label={axis === "front" ? "Front" : "Side"}
            fillHeight
            compactLabel
            className="min-h-[140px] overflow-hidden rounded-md bg-transparent"
          />
        ))}
      </div>
    </div>
  );
}
