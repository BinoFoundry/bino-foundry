import { cn } from "@/lib/utils";

import type { CustomiserStep } from "../constants";
import { CUSTOMISER_STEPS } from "../constants";

interface StepProgressProps {
  current: CustomiserStep;
  className?: string;
}

export function StepProgress({ current, className }: StepProgressProps) {
  const currentIndex = CUSTOMISER_STEPS.findIndex((s) => s.id === current);

  return (
    <div className={cn("flex items-center gap-2 rounded-2xl border border-border bg-card p-3", className)}>
      {CUSTOMISER_STEPS.map((step, index) => {
        const completed = index < currentIndex;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full transition-all",
                active && "scale-125 bg-primary",
                completed && "bg-emerald-500",
                !active && !completed && "bg-muted",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "hidden text-[10px] font-bold uppercase tracking-wider sm:inline",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.shortLabel}
            </span>
            {index < CUSTOMISER_STEPS.length - 1 && (
              <div className="mx-1 hidden h-px flex-1 bg-border sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
