import { SunglassesCompositor } from "@/render";
import type { SunglassesCompositorConfig } from "@/render/types";

import { BuilderPreviewFitScope } from "@/features/builder/components/BuilderPreviewFitScope";
import { getCustomiserDisplayViews } from "../utils/compositor-views";
import { NO_PREVIEW_MESSAGE } from "../utils/frame-plates";
import { SUNGLASSES_COPY } from "../copy";

interface SunglassesPreviewPanelProps {
  config: SunglassesCompositorConfig;
  unavailableFrame?: boolean;
  /**
   * When true (Step 1 — Frame), show the cropped plate with no lens compositing.
   */
  plateOnly?: boolean;
}

function PreviewSlot({
  config,
  axis,
  aspectRatio,
  label,
  plateOnly,
}: {
  config: SunglassesCompositorConfig;
  axis: ReturnType<typeof getCustomiserDisplayViews>[number]["axis"];
  aspectRatio: ReturnType<typeof getCustomiserDisplayViews>[number]["aspectRatio"];
  label: string;
  plateOnly?: boolean;
}) {
  return (
    <SunglassesCompositor
      config={config}
      allowSvgFallback={false}
      view={axis}
      aspectRatio={aspectRatio}
      label={label}
      emptyMessage={NO_PREVIEW_MESSAGE[axis]}
      className="h-full min-h-0 w-full"
      fillHeight
      compactLabel
      plateOnly={plateOnly}
    />
  );
}

/** Front + optional side / 45° live previews (synced to the same configuration). */
export function SunglassesPreviewPanel({
  config,
  unavailableFrame = false,
  plateOnly = false,
}: SunglassesPreviewPanelProps) {
  // Show front + side on both the frame step and the tint step: the side tints are now
  // real photographed plates (not procedural), so they hold up during tint selection too.
  const displayViews = getCustomiserDisplayViews(config, { includeSide: true });
  const primary = displayViews[0];
  const secondary = displayViews.slice(1);

  if (unavailableFrame) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-foreground">{SUNGLASSES_COPY.unavailableFrameName}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This frame is no longer available. {SUNGLASSES_COPY.unavailableFramePrompt}
        </p>
      </div>
    );
  }

  if (!primary) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Preview unavailable</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <BuilderPreviewFitScope
        builder="sunglasses"
        className="flex min-h-0 flex-1 flex-col justify-center px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 sm:gap-3.5">
          <div className="flex min-h-0 flex-[3] flex-col">
            <PreviewSlot
              config={config}
              axis={primary.axis}
              aspectRatio={primary.aspectRatio}
              label={primary.label}
              plateOnly={plateOnly}
            />
          </div>

          {secondary.length > 0 ? (
            secondary.length === 1 ? (
              <div className="flex min-h-0 flex-[2] flex-col">
                <PreviewSlot
                  config={config}
                  axis={secondary[0]!.axis}
                  aspectRatio={secondary[0]!.aspectRatio}
                  label={secondary[0]!.label}
                  plateOnly={plateOnly}
                />
              </div>
            ) : (
              <div className="grid min-h-0 flex-[2] grid-cols-2 gap-3 sm:gap-3.5">
                {secondary.map((view) => (
                  <PreviewSlot
                    key={view.axis}
                    config={config}
                    axis={view.axis}
                    aspectRatio={view.aspectRatio}
                    label={view.label}
                    plateOnly={plateOnly}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
      </BuilderPreviewFitScope>
    </div>
  );
}
