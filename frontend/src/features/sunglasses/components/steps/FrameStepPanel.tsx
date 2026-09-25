import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { resolveFrameThumb, resolveTintedPlate } from "@/render/components/tinted-plate-proto";
import type { FrameOption } from "@/lib/luxe-data";

import { formatCurrency } from "@bino-foundry/shared/currency";

import { SUNGLASSES_COPY, SUNGLASSES_PRICE } from "../../copy";
import { getFrontPlateUrl } from "../../utils/frame-plates";
import { isUnavailableFrame, unavailableIssueForFrame } from "../../unavailable-frame";

interface FrameStepPanelProps {
  frames: FrameOption[];
  selectedFrame: FrameOption;
  selectedFrameId: string;
  currencyCode: string;
  onSelectFrame: (id: string) => void;
}

function FrameCardThumbnail({ frame }: { frame: FrameOption }) {
  // Use the small pre-sized thumbnail (crisp at card size); fall back to the full front plate,
  // then to the frame's backend render view.
  const src =
    resolveFrameThumb(frame.name) ??
    resolveTintedPlate(frame.name, "2b2b2b", "front")?.file ??
    getFrontPlateUrl(frame);

  if (src) {
    return (
      <div className="flex aspect-[5/3] w-full items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30">
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full object-contain p-0.5"
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
  selectedFrame,
  selectedFrameId,
  currencyCode,
  onSelectFrame,
}: FrameStepPanelProps) {
  const unavailable = isUnavailableFrame(selectedFrame);
  const unavailableIssue = unavailableIssueForFrame(selectedFrame);

  if (frames.length === 0 && !unavailable) {
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

      {unavailable ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-foreground">{SUNGLASSES_COPY.unavailableFrameName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {unavailableIssue === "deleted"
              ? SUNGLASSES_COPY.unavailableFrameDeleted
              : SUNGLASSES_COPY.unavailableFrameStatus}
            {" · "}
            {SUNGLASSES_COPY.unavailableFramePrompt}
          </p>
        </div>
      ) : null}

      <div
        role="radiogroup"
        aria-label="Frame styles"
        className="grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-3.5"
      >
        {frames.map((frame) => {
          const active = frame.id === selectedFrameId;
          const description = frame.description?.trim() ?? "";
          return (
            <div key={frame.id} className="relative h-full">
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${frame.name}, ${formatCurrency(frame.price, currencyCode)}`}
                onClick={() => onSelectFrame(frame.id)}
                className={cn(
                  "flex h-full w-full min-w-0 flex-col rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3",
                  active
                    ? "state-selected-subtle"
                    : "border-border bg-card state-hoverable",
                )}
              >
                <FrameCardThumbnail frame={frame} />
                <div className="mt-2 flex min-h-0 flex-1 flex-col justify-end space-y-0.5">
                  <p className="type-small truncate font-medium text-foreground sm:text-body">{frame.name}</p>
                  <p className={SUNGLASSES_PRICE.item}>
                    {formatCurrency(frame.price, currencyCode)}
                  </p>
                </div>
              </button>

              {/* Info popover with the frame's specifications (edit the frame's Description in
                  admin). Kept off the card face so the grid stays uncluttered. */}
              {description ? (
                <HoverCard openDelay={80} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${frame.name} specifications`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent align="end" className="w-56">
                    <p className="text-sm font-medium text-foreground">{frame.name}</p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </HoverCardContent>
                </HoverCard>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
