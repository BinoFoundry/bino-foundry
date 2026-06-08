import { cn } from "@/lib/utils";

import type { CustomiserStep } from "../constants";
import { SUNGLASSES_NAV_STEPS } from "../constants";

interface SunglassesHorizontalStepsProps {
  current: CustomiserStep;
  onSelect: (step: CustomiserStep) => void;
  className?: string;
}

export function SunglassesHorizontalSteps({
  current,
  onSelect,
  className,
}: SunglassesHorizontalStepsProps) {
  const currentNavIndex = SUNGLASSES_NAV_STEPS.findIndex((s) => s.flowStep === current);

  return (
    <nav aria-label="Configuration steps" className={cn("w-full", className)}>
      <ol className="flex items-start">
        {SUNGLASSES_NAV_STEPS.map((step, index) => {
          const completed = index < currentNavIndex;
          const active = index === currentNavIndex;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center">
              <button
                type="button"
                onClick={() => onSelect(step.flowStep)}
                aria-current={active ? "step" : undefined}
                className="group flex w-full flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : completed
                        ? "border-success bg-success/10 text-success"
                        : "border-border bg-background text-muted-foreground group-hover:border-primary/40",
                  )}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "type-label w-full truncate px-0.5 text-center text-[10px] sm:text-xs",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < SUNGLASSES_NAV_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 mt-3.5 h-px w-full min-w-[6px] flex-1",
                    index < currentNavIndex ? "bg-success/40" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
