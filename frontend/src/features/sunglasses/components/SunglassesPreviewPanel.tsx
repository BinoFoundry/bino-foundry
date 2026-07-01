import { SunglassesCompositor } from "@/render";
import type { SunglassesCompositorConfig } from "@/render/types";

import { BuilderPreviewFitScope } from "@/features/builder/components/BuilderPreviewFitScope";
import { getCustomiserDisplayViews } from "../utils/compositor-views";
import { NO_PREVIEW_MESSAGE } from "../utils/frame-plates";

interface SunglassesPreviewPanelProps {
  config: SunglassesCompositorConfig;
}

function PreviewSlot({
  config,
  axis,
  aspectRatio,
  label,
}: {
  config: SunglassesCompositorConfig;
  axis: ReturnType<typeof getCustomiserDisplayViews>[number]["axis"];
  aspectRatio: ReturnType<typeof getCustomiserDisplayViews>[number]["aspectRatio"];
  label: string;
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
    />
  );
}

/** Front + optional side / 45° live previews (synced to the same configuration). */
export function SunglassesPreviewPanel({ config }: SunglassesPreviewPanelProps) {
  const displayViews = getCustomiserDisplayViews(config);
  const primary = displayViews[0];
  const secondary = displayViews.slice(1);

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
