import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface ScrollMoreHintProps {
  visible: boolean;
  label?: string;
  className?: string;
}

/** Fade + chevron cue when a scroll container has more content below the fold. */
export function ScrollMoreHint({
  visible,
  label = "More options below",
  className,
}: ScrollMoreHintProps) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end pb-2 pt-10 transition-opacity duration-300",
        "bg-gradient-to-t from-background via-background/90 to-transparent",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm",
          visible && "motion-safe:animate-pulse",
        )}
      >
        <ChevronDown className="h-3.5 w-3.5 motion-safe:animate-bounce" aria-hidden />
        <span>{label}</span>
      </div>
    </div>
  );
}
