import { cn } from "@/lib/utils";
import { BRACELET_COPY } from "../copy";
import type { DragOnboardingHint } from "../hooks/useBraceletDragOnboarding";

interface BraceletDragOnboardingHintProps {
  hint: DragOnboardingHint;
  visible: boolean;
}

export function BraceletDragOnboardingHint({ hint, visible }: BraceletDragOnboardingHintProps) {
  if (!hint) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 z-40 max-w-[15rem] -translate-x-1/2 -translate-y-[118%] transition-opacity duration-[450ms] ease-out motion-reduce:transition-none lg:-translate-y-[125%]",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="rounded-xl border border-border/60 bg-background/92 px-3.5 py-2.5 text-center shadow-lg backdrop-blur-md">
        <p className="text-xs font-medium leading-snug text-foreground sm:text-[13px]">
          {BRACELET_COPY.dragOnboardingInitial}
        </p>
      </div>
    </div>
  );
}
