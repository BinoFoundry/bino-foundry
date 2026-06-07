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
    <nav
      aria-label="Customisation steps"
      className={cn("surface-card flex items-center gap-2 rounded-2xl p-3", className)}
    >
      <ol className="flex w-full items-center gap-2">
        {CUSTOMISER_STEPS.map((step, index) => {
          const completed = index < currentIndex;
          const active = step.id === current;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 shrink-0 rounded-full transition-all motion-safe-animate",
                  active && "scale-125 bg-primary",
                  completed && "bg-success",
                  !active && !completed && "bg-muted",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "type-label truncate sm:inline",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span className="sr-only">
                  Step {index + 1} of {CUSTOMISER_STEPS.length}:{" "}
                </span>
                {step.label}
              </span>
              {index < CUSTOMISER_STEPS.length - 1 && (
                <div className="mx-1 hidden h-px flex-1 bg-border sm:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
