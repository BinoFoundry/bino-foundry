import { SunglassesCompositor } from "@/render";
import type { SunglassesCompositorConfig } from "@/render/types";

interface DisplayColumnProps {
  config: SunglassesCompositorConfig;
  summaryText: string;
  totalPrice: number;
  lensDisclaimer?: string;
  showSummaryCard?: boolean;
}

/** Front + side compositor previews (project brief two-view display). */
export function DisplayColumn({
  config,
  summaryText,
  totalPrice,
  lensDisclaimer,
  showSummaryCard = true,
}: DisplayColumnProps) {
  return (
    <div className="flex flex-col gap-6">
      <SunglassesCompositor config={config} view="front" aspectRatio="16/10" label="Front View" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SunglassesCompositor config={config} view="side" aspectRatio="video" label="Side View" />

        {showSummaryCard && (
          <div className="glass-panel flex flex-col justify-center rounded-[2rem] p-6">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Current config
            </h4>
            <p className="font-semibold italic text-foreground">{summaryText}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-3xl font-black text-primary">${totalPrice}</span>
              <span className="text-xs font-bold uppercase text-muted-foreground">USD</span>
            </div>
            {lensDisclaimer && (
              <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
