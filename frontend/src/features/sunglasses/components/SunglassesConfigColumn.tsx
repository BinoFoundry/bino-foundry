import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
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

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-border/50 bg-background/60 md:border-t lg:border-l lg:border-t-0",
        className,
      )}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        data-scroll-isolate="true"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="hidden shrink-0 border-b border-border/60 px-4 py-3 sm:px-5 lg:block">
          <SunglassesHorizontalSteps current={flow.step} onSelect={flow.goTo} />
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-4">
          <CustomiserPanel
            flow={flow}
            state={state}
            currencyCode={currencyCode}
            showFooter={false}
          />

          {!flow.isLast ? (
            <Button type="button" className="mt-5 w-full" size="lg" onClick={flow.goNext}>
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {flow.isLast ? (
          <div className="mt-auto border-t border-border/60 px-4 py-5 sm:px-5">
            <SunglassesConfigurationSummary
              totalPrice={totalPrice}
              currencyCode={currencyCode}
              onSaveDesign={onSaveDesign}
              onAddToCart={onAddToCart}
              saving={saving}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
