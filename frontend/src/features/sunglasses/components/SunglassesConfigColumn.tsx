import { ChevronRight } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { ScrollMoreHint } from "@/components/common";
import { useScrollOverflowHint } from "@/hooks/use-scroll-overflow-hint";
import { cn } from "@/lib/utils";

import { useCustomiserFlow } from "../hooks/useCustomiserFlow";
import type { useSunglassesCustomiserState } from "../hooks/useSunglassesCustomiserState";
import { CustomiserPanel } from "./CustomiserPanel";
import { SunglassesConfigurationSummary } from "./SunglassesConfigurationSummary";
import { SunglassesHorizontalSteps } from "./SunglassesHorizontalSteps";

type CustomiserState = ReturnType<typeof useSunglassesCustomiserState>;

interface SunglassesConfigColumnProps {
  flow: ReturnType<typeof useCustomiserFlow>;
  state: CustomiserState;
  currencyCode: string;
  onSaveDesign?: () => void;
  onAddToCart?: () => void;
  saving?: boolean;
  className?: string;
}

const SCROLL_HINT_LABELS: Partial<Record<ReturnType<typeof useCustomiserFlow>["step"], string>> = {
  frame: "More frames below",
  rx: "More options below",
  extras: "More add-ons below",
};

export function SunglassesConfigColumn({
  flow,
  state,
  currencyCode,
  onSaveDesign,
  onAddToCart,
  saving = false,
  className,
}: SunglassesConfigColumnProps) {
  const { totalPrice } = state;
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMoreBelow = useScrollOverflowHint(scrollRef, [flow.step]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-border/50 bg-background/60 md:border-t lg:border-l lg:border-t-0",
        className,
      )}
    >
      <div className="hidden shrink-0 border-b border-border/60 px-4 py-3 sm:px-5 lg:block">
        <SunglassesHorizontalSteps current={flow.step} onSelect={flow.goTo} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className={cn(
            "h-full min-h-0",
            flow.step === "lens"
              ? "flex flex-col overflow-hidden"
              : "customiser-options-scroll overflow-y-auto overscroll-contain",
          )}
          data-scroll-isolate="true"
          onWheel={flow.step === "lens" ? undefined : (e) => e.stopPropagation()}
        >
          <div
            className={cn(
              "px-4 sm:px-5",
              flow.step === "lens" ? "flex min-h-0 flex-1 flex-col py-2 sm:py-2.5" : "py-3 pb-8 sm:py-4 sm:pb-10",
            )}
          >
            <CustomiserPanel
              flow={flow}
              state={state}
              currencyCode={currencyCode}
              showFooter={false}
            />

            {((!flow.isLast && flow.step !== "lens") || flow.isLast) && (
              <div className="mt-8 border-t border-border/70 pt-6">
                {!flow.isLast && flow.step !== "lens" ? (
                  <Button type="button" className="w-full" size="lg" onClick={flow.goNext}>
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <SunglassesConfigurationSummary
                    totalPrice={totalPrice}
                    currencyCode={currencyCode}
                    onSaveDesign={onSaveDesign}
                    onAddToCart={onAddToCart}
                    saving={saving}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <ScrollMoreHint
          visible={flow.step !== "lens" && hasMoreBelow}
          label={SCROLL_HINT_LABELS[flow.step] ?? "More options below"}
        />
      </div>
    </aside>
  );
}
