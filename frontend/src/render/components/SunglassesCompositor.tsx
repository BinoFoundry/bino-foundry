import { useId, useMemo } from "react";

import { buildCompositorStack } from "../engine/compositor";
import { LayerStack } from "../layers/LayerStack";
import type { CompositorView, SunglassesCompositorConfig } from "../types";
import { CanvasCompositorView } from "./CanvasCompositorView";
import { CompositorViewport, type CompositorAspectRatio } from "./CompositorViewport";

export interface SunglassesCompositorProps {
  config: SunglassesCompositorConfig;
  view?: CompositorView;
  aspectRatio?: CompositorAspectRatio;
  label?: string;
  className?: string;
  /** When false, missing plate shows `emptyMessage` instead of the SVG demo stack. */
  allowSvgFallback?: boolean;
  emptyMessage?: string;
}

/**
 * Sunglasses preview — canvas masked photos (bino-rendering) or optional SVG demo stack.
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

  const maskedPlate = config.renderMode === "masked-photo" ? config.maskedViews?.[view] : null;

  if (maskedPlate?.plateUrl) {
    return (
      <CanvasCompositorView
        view={view}
        plate={{
          plateUrl: maskedPlate.plateUrl,
          width: maskedPlate.width,
          height: maskedPlate.height,
          maskConfig: maskedPlate.maskConfig,
        }}
        tintTop={config.tint.top}
        tintBottom={config.tint.bottom}
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
