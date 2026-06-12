import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common";
import type { FrameOption } from "@/lib/luxe-data";

import { formatCurrency } from "@bino-foundry/shared/currency";

import { SUNGLASSES_COPY } from "../../copy";
import { getFrontPlateUrl } from "../../utils/frame-plates";

interface FrameStepPanelProps {
  frames: FrameOption[];
  selectedFrameId: string;
  currencyCode: string;
  onSelectFrame: (id: string) => void;
}

function FrameCardThumbnail({ frame }: { frame: FrameOption }) {
  const src = getFrontPlateUrl(frame);

  if (src) {
    return (
      <div className="flex aspect-[5/3] w-full items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30">
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full object-contain p-1"
          crossOrigin="anonymous"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-[5/3] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-2 text-center text-[10px] leading-tight text-muted-foreground">
      No preview image
    </div>
  );
}

export function FrameStepPanel({
  frames,
  selectedFrameId,
  currencyCode,
  onSelectFrame,
}: FrameStepPanelProps) {
  if (frames.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="type-h3">{SUNGLASSES_COPY.frameStepTitle}</h3>
        </div>
        <EmptyState message="No frames are available yet. Please check back soon." title="No frames yet" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="type-h3">{SUNGLASSES_COPY.frameStepTitle}</h3>

      <div
        role="radiogroup"
        aria-label="Frame styles"
        className="grid grid-cols-2 gap-3"
      >
        {frames.map((frame) => {
          const active = frame.id === selectedFrameId;
          return (
            <button
              key={frame.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${frame.name}, ${formatCurrency(frame.price, currencyCode)}`}
              onClick={() => onSelectFrame(frame.id)}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "state-selected-subtle"
                  : "border-border bg-card state-hoverable",
              )}
            >
              <FrameCardThumbnail frame={frame} />
              <div className="mt-2 min-w-0 space-y-0.5">
                <p className="type-small truncate font-medium text-foreground sm:text-body">{frame.name}</p>
                {frame.description ? (
                  <p className="hidden line-clamp-2 text-[10px] text-muted-foreground sm:block">
                    {frame.description}
                  </p>
                ) : null}
                <p className="type-price text-label text-primary sm:text-small">
                  {formatCurrency(frame.price, currencyCode)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
