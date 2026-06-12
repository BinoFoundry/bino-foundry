import { Fragment } from "react";

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
      <ol className="flex w-full items-start">
        {SUNGLASSES_NAV_STEPS.map((step, index) => {
          const completed = index < currentNavIndex;
          const active = index === currentNavIndex;

          return (
            <Fragment key={step.id}>
              <li className="flex min-w-0 flex-1 flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelect(step.flowStep)}
                  aria-current={active ? "step" : undefined}
                  className="group relative z-10 flex w-full min-w-0 flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                      "type-label w-full px-0.5 text-center text-[9px] leading-tight sm:text-[10px]",
                      active ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>

              {index < SUNGLASSES_NAV_STEPS.length - 1 ? (
                <li
                  aria-hidden
                  className="pointer-events-none flex min-w-[0.75rem] flex-[0.75] items-start pt-3.5"
                >
                  <div
                    className={cn(
                      "h-px w-full",
                      index < currentNavIndex ? "bg-success/40" : "bg-border",
                    )}
                  />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
