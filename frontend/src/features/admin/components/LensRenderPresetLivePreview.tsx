import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { LensClipRenderSettings } from "@bino-foundry/shared/types";

import { SunglassesCompositor } from "@/render/components/SunglassesCompositor";
import { buildCustomiserCompositorConfig } from "@/render/adapters/customiser-config";
import { isFrameViewClipReady } from "@/render/lens-clip";
import { useCatalogue } from "@/state/catalogue";
import type { FrameEntry } from "@/data/glasses";
import type { FrameViewAxis } from "@/types/frame-rendering";
import { cn } from "@/lib/utils";

export type PreviewEnvironment =
  | "white-studio"
  | "grey-studio"
  | "outdoor-bright"
  | "outdoor-cloudy"
  | "indoor"
  | "transparent";

const ENVIRONMENTS: { id: PreviewEnvironment; label: string; style: CSSProperties }[] = [
  { id: "white-studio", label: "White Studio", style: { background: "#f4f4f5" } },
  { id: "grey-studio", label: "Grey Studio", style: { background: "#9ca3af" } },
  {
    id: "outdoor-bright",
    label: "Outdoor Bright",
    style: {
      background: "linear-gradient(180deg, #87b7e8 0%, #d4e8f7 45%, #c8d9a8 100%)",
    },
  },
  {
    id: "outdoor-cloudy",
    label: "Outdoor Cloudy",
    style: {
      background: "linear-gradient(180deg, #8a96a3 0%, #b8c0c8 50%, #9aa890 100%)",
    },
  },
  {
    id: "indoor",
    label: "Indoor",
    style: {
      background: "linear-gradient(180deg, #3d342c 0%, #6b5a4a 40%, #8a7560 100%)",
    },
  },
  {
    id: "transparent",
    label: "Transparent",
    style: {
      backgroundImage:
        "linear-gradient(45deg, #d4d4d8 25%, transparent 25%), linear-gradient(-45deg, #d4d4d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d8 75%), linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)",
      backgroundSize: "16px 16px",
      backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
      backgroundColor: "#fafafa",
    },
  },
];

function framesWithClipReady(frames: FrameEntry[]): FrameEntry[] {
  return frames.filter(
    (frame) =>
      frame.isActive !== false &&
      frame.renderViews?.some((v) => v.plateUrl && isFrameViewClipReady(v)),
  );
}

interface LensRenderPresetLivePreviewProps {
  draftSettings: LensClipRenderSettings;
  previewTintHex: string;
  onPreviewTintChange: (hex: string) => void;
}

/**
 * Live preset preview — exact same SunglassesCompositor / SVG pipeline as customers.
 * `showOriginalLens` is admin-only and never written to presets or customer config.
 */
export function LensRenderPresetLivePreview({
  draftSettings,
  previewTintHex,
  onPreviewTintChange,
}: LensRenderPresetLivePreviewProps) {
  const { frames } = useCatalogue();
  const previewFrames = useMemo(() => framesWithClipReady(frames), [frames]);
  const [frameId, setFrameId] = useState("");
  const [environment, setEnvironment] = useState<PreviewEnvironment>("white-studio");
  const [showOriginalLens, setShowOriginalLens] = useState(true);
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
      top: previewTintHex,
      bottom: previewTintHex,
      category: "classic" as const,
      opacity: 1,
    }),
    [previewTintHex],
  );

  const previewConfig = useMemo(() => {
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
      renderSettingsOverride: draftSettings,
    });
  }, [selectedFrame, tint, draftSettings]);

  const envStyle = ENVIRONMENTS.find((e) => e.id === environment)?.style ?? ENVIRONMENTS[0].style;
  const views = (["front", "side"] as FrameViewAxis[]).filter((axis) =>
    selectedFrame?.renderViews?.some((v) => v.view === axis && v.plateUrl),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

        <label className="space-y-1 text-xs">
          <span className="font-medium text-foreground">Preview lens colour</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={previewTintHex}
              onChange={(e) => onPreviewTintChange(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-background"
              title="Temporary preview colour only — never overwrites catalogue tints"
            />
            <input
              type="text"
              value={previewTintHex}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(v)) onPreviewTintChange(v);
              }}
              className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm"
            />
          </div>
        </label>

        <label className="space-y-1 text-xs">
          <span className="font-medium text-foreground">Preview background</span>
          <select
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as PreviewEnvironment)}
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env.id} value={env.id}>
                {env.label}
              </option>
            ))}
          </select>
        </label>
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
              (preview only — customers always see the original lens)
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
          <span className="font-medium text-foreground">Split: with / without original</span>
        </label>
      </div>

      {!selectedFrame || !previewConfig ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          Add an active frame with a ready lens clip to preview presets.
        </div>
      ) : (
        <div
          className={cn(
            "grid min-h-[320px] flex-1 gap-3 rounded-lg border border-border p-3",
            splitCompare ? "lg:grid-cols-2" : "grid-cols-1",
          )}
          style={envStyle}
        >
          {splitCompare ? (
            <>
              <PreviewPane
                title="With original lens"
                config={previewConfig}
                views={views}
                showOriginalLens
              />
              <PreviewPane
                title="Without original lens"
                config={previewConfig}
                views={views}
                showOriginalLens={false}
              />
            </>
          ) : (
            <PreviewPane
              title="Live preview"
              config={previewConfig}
              views={views}
              showOriginalLens={showOriginalLens}
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
  showOriginalLens,
}: {
  title: string;
  config: NonNullable<ReturnType<typeof buildCustomiserCompositorConfig>>;
  views: FrameViewAxis[];
  showOriginalLens: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-md bg-black/5 p-2 backdrop-blur-[1px]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/80">{title}</p>
      <div className={cn("grid min-h-0 flex-1 gap-2", views.length > 1 ? "sm:grid-cols-2" : "")}>
        {views.map((axis) => (
          <SunglassesCompositor
            key={`${title}-${axis}-${showOriginalLens ? "orig" : "no-orig"}`}
            config={config}
            view={axis}
            label={axis === "front" ? "Front" : "Side"}
            fillHeight
            compactLabel
            showOriginalLens={showOriginalLens}
            className="min-h-[140px] overflow-hidden rounded-md bg-transparent"
          />
        ))}
      </div>
    </div>
  );
}
