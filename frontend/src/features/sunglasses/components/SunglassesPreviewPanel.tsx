import { SunglassesCompositor } from "@/render";
import type { SunglassesCompositorConfig } from "@/render/types";

import { getCustomiserDisplayViews } from "../utils/compositor-views";
import { NO_PREVIEW_MESSAGE } from "../utils/frame-plates";

interface SunglassesPreviewPanelProps {
  config: SunglassesCompositorConfig;
}

/** Hero live preview — dominant visual, centered in the preview workspace. */
export function SunglassesPreviewPanel({ config }: SunglassesPreviewPanelProps) {
  const displayViews = getCustomiserDisplayViews(config);
  const primary = displayViews[0];

  if (!primary) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Preview unavailable</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center p-6 sm:p-8 lg:p-10">
      <div className="surface-card w-full max-w-3xl rounded-[2rem] p-4 sm:p-6">
        <SunglassesCompositor
          config={config}
          allowSvgFallback={false}
          view={primary.axis}
          aspectRatio={primary.aspectRatio}
          label={primary.label}
          emptyMessage={NO_PREVIEW_MESSAGE[primary.axis]}
          className="w-full"
        />
      </div>
    </div>
  );
}
