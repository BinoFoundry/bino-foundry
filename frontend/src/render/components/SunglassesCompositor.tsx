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
}: SunglassesCompositorProps) {
  const instanceId = useId().replace(/:/g, "");
  const stack = useMemo(() => buildCompositorStack(config, view), [config, view]);

  const plateView =
    config.renderMode === "svg-clip"
      ? config.clipViews?.[view] ?? config.maskedViews?.[view]
      : null;

  const clipConfig = plateView ? resolveLensClipConfig(plateView) : null;

  if (plateView?.plateUrl && clipConfig) {
    return (
      <SvgClipCompositorView
        view={view}
        plate={{
          plateUrl: plateView.plateUrl,
          width: plateView.width,
          height: plateView.height,
          clipConfig,
        }}
        tint={config.tint}
        aspectRatio={aspectRatio}
        label={label}
        className={className}
      />
    );
  }

  if (!allowSvgFallback) {
    return (
      <CompositorViewport aspectRatio={aspectRatio} label={label} className={className}>
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="max-w-xs text-sm font-medium text-muted-foreground">
            {emptyMessage ?? `No preview available for ${label}`}
          </p>
        </div>
      </CompositorViewport>
    );
  }

  return (
    <CompositorViewport aspectRatio={aspectRatio} label={label} className={className}>
      <LayerStack layers={stack.layers} instanceId={instanceId} />
    </CompositorViewport>
  );
}
