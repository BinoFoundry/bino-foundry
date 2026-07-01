import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { BRACELET_COPY } from "../copy";

interface BraceletDragOnboardingHintProps {
  active: boolean;
  visible: boolean;
  onDismiss: () => void;
}

export function BraceletDragOnboardingHint({ active, visible, onDismiss }: BraceletDragOnboardingHintProps) {
  if (!active) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 z-40 max-w-[16rem] -translate-x-1/2 -translate-y-[118%] transition-opacity duration-[450ms] ease-out motion-reduce:transition-none lg:-translate-y-[125%]",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-auto relative rounded-xl border border-border/60 bg-background/92 py-2.5 pl-3.5 pr-9 text-center shadow-lg backdrop-blur-md"
      >
        <p className="text-xs font-medium leading-snug text-foreground sm:text-[13px]">
          {BRACELET_COPY.dragOnboardingInitial}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-1.5 top-1.5 rounded-full p-1 text-muted-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label={BRACELET_COPY.dismissHint}
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
