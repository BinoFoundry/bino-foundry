import { useId, useMemo } from "react";

import { resolveLensClipConfig } from "@/render/lens-clip";
import { buildCompositorStack } from "../engine/compositor";
import { LayerStack } from "../layers/LayerStack";
import type { CompositorView, SunglassesCompositorConfig } from "../types";
import { SvgClipCompositorView } from "./SvgClipCompositorView";
import { CompositorViewport, type CompositorAspectRatio } from "./CompositorViewport";

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
}: SunglassesCompositorProps) {
  const instanceId = useId().replace(/:/g, "");
  const stack = useMemo(() => buildCompositorStack(config, view), [config, view]);
  const viewportVariant = fillHeight ? "fill" : "aspect";

  const plateView =
    config.renderMode === "svg-clip"
      ? config.clipViews?.[view] ?? config.maskedViews?.[view]
      : null;

  const clipConfig = plateView ? resolveLensClipConfig(plateView) : null;

  if (plateView?.plateUrl) {
    return (
      <SvgClipCompositorView
        view={view}
        plate={{
          plateUrl: plateView.plateUrl,
          width: plateView.width,
          height: plateView.height,
          clipConfig: clipConfig ?? {
            version: 1,
            imageWidth: plateView.width,
            imageHeight: plateView.height,
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
