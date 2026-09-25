import { useId, useMemo } from "react";

import { resolveLensClipConfig } from "@/render/lens-clip";
import { buildCompositorStack } from "../engine/compositor";
import { LayerStack } from "../layers/LayerStack";
import type { CompositorView, SunglassesCompositorConfig } from "../types";
import { SvgClipCompositorView } from "./SvgClipCompositorView";
import { CompositorViewport, type CompositorAspectRatio } from "./CompositorViewport";
import { resolveTintedPlate } from "./tinted-plate-proto";

export interface SunglassesCompositorProps {
  config: SunglassesCompositorConfig;
  view?: CompositorView;
  aspectRatio?: CompositorAspectRatio;
  label?: string;
  className?: string;
  allowSvgFallback?: boolean;
  emptyMessage?: string;
  /** Fill parent height instead of fixed aspect ratio (builder dual preview). */
  fillHeight?: boolean;
  compactLabel?: boolean;
  /**
   * Step 1 — Frame: show the cropped plate asset only (no lens compositing).
   * Lens config remains on the frame; it is simply not applied until Step 2+.
   */
  plateOnly?: boolean;
}


/**
 * Sunglasses preview — SVG clipPath tint on photo plates, or vector demo stack fallback.
 */
export function SunglassesCompositor({
  config,
  view = "front",
  aspectRatio = "16/10",
  label = "Front View",
  className,
  allowSvgFallback = true,
  emptyMessage,
  fillHeight = false,
  compactLabel = false,
  plateOnly = false,
}: SunglassesCompositorProps) {
  const instanceId = useId().replace(/:/g, "");
  const stack = useMemo(() => buildCompositorStack(config, view), [config, view]);
  const viewportVariant = fillHeight ? "fill" : "aspect";

  const plateView =
    config.renderMode === "svg-clip"
      ? config.clipViews?.[view] ?? config.maskedViews?.[view]
      : null;

  const clipConfig = plateView ? resolveLensClipConfig(plateView) : null;

  // PROTOTYPE: a photograph of this frame already wearing this tint replaces the
  // whole plate, and no lens compositing runs at all.
  const tinted = plateOnly ? null : resolveTintedPlate(config.frameLabel, config.tint?.top, view);
  // When a tint is chosen but this frame has no real photo for it, show the clear
  // frame rather than procedurally tinting it (which looks wrong on these frames).
  // `?noproto` opts back into procedural tinting for everything.
  const noproto = typeof window !== "undefined" && window.location.search.includes("noproto");
  const missingTintPhoto = !plateOnly && !noproto && !tinted && Boolean(config.tint?.top);

  if (plateView?.plateUrl) {
    // Step 1 uses the cropped plate as-is. Do not fall back to originalPlateUrl —
    // that would undo the frame crop. Lens clip/render stay inactive via plateOnly.
    const plateUrl = tinted?.file ?? plateView.plateUrl;
    const width = tinted?.w ?? plateView.width;
    const height = tinted?.h ?? plateView.height;

    return (
      <SvgClipCompositorView
        view={view}
        plateOnly={plateOnly}
        plate={{
          plateUrl,
          width,
          height,
          clipConfig: (tinted || missingTintPhoto ? null : clipConfig) ?? {
            version: 1,
            imageWidth: width,
            imageHeight: height,
            lenses: [],
          },
        }}
        tint={config.tint}
        aspectRatio={aspectRatio}
        label={label}
        className={className}
        fillHeight={fillHeight}
        compactLabel={compactLabel}
      />
    );
  }

  if (!allowSvgFallback) {
    return (
      <CompositorViewport
        aspectRatio={aspectRatio}
        label={label}
        className={className}
        variant={viewportVariant}
        compactLabel={compactLabel}
      >
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="max-w-xs text-sm font-medium text-muted-foreground">
            {emptyMessage ?? `No preview available for ${label}`}
          </p>
        </div>
      </CompositorViewport>
    );
  }

  return (
    <CompositorViewport
      aspectRatio={aspectRatio}
      label={label}
      className={className}
      variant={viewportVariant}
      compactLabel={compactLabel}
    >
      <LayerStack layers={stack.layers} instanceId={instanceId} />
    </CompositorViewport>
  );
}
