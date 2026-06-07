import { SunglassesCompositor } from "@/render";
import type { SunglassesCompositorConfig } from "@/render/types";
import type { CompositorView } from "@/render/types";

import { getCustomiserDisplayViews } from "../utils/compositor-views";
import { NO_PREVIEW_MESSAGE } from "../utils/frame-plates";

interface DisplayColumnProps {
  config: SunglassesCompositorConfig;
  summaryText: string;
  totalPrice: number;
  lensDisclaimer?: string;
  showSummaryCard?: boolean;
  polarized?: boolean;
  tintCode?: string;
  currencyCode?: string;
}

/** Front + optional side / 45° compositor previews (synced to same config). */
export function DisplayColumn({
  config,
  summaryText,
  totalPrice,
  lensDisclaimer,
  showSummaryCard = true,
  polarized,
  tintCode,
  currencyCode = "USD",
}: DisplayColumnProps) {
  const previewProps = {
    config,
    allowSvgFallback: false as const,
  };

  const displayViews = getCustomiserDisplayViews(config);
  const primary = displayViews[0] ?? { axis: "front" as CompositorView, label: "Front View", aspectRatio: "16/10" as const };
  const secondary = displayViews.slice(1);

  return (
    <div className="flex flex-col gap-6">
      <SunglassesCompositor
        {...previewProps}
        view={primary.axis}
        aspectRatio={primary.aspectRatio}
        label={primary.label}
        emptyMessage={NO_PREVIEW_MESSAGE[primary.axis]}
      />

      {(secondary.length > 0 || showSummaryCard) && (
        <div
          className={`grid grid-cols-1 gap-6 ${secondary.length > 0 && showSummaryCard ? "md:grid-cols-2" : ""}`}
        >
          {secondary.map((v) => (
            <SunglassesCompositor
              key={v.axis}
              {...previewProps}
              view={v.axis}
              aspectRatio={v.aspectRatio}
              label={v.label}
              emptyMessage={NO_PREVIEW_MESSAGE[v.axis]}
            />
          ))}

          {showSummaryCard && (
            <div className="glass-panel flex flex-col justify-center rounded-[2rem] p-6">
              <h4 className="label-eyebrow mb-2 text-muted-foreground">
                Current config
              </h4>
              <p className="type-body-lg font-light italic text-foreground">{summaryText}</p>
              {tintCode ? (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">Tint code {tintCode}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Lens type: {polarized ? "Polarised" : "Standard (non-polarised)"}
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="type-price text-3xl text-primary">${totalPrice}</span>
                <span className="type-label text-muted-foreground">{currencyCode}</span>
              </div>
              {lensDisclaimer && (
                <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
