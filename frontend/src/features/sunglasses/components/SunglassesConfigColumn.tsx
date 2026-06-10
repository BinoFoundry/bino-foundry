import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useCustomiserFlow } from "../hooks/useCustomiserFlow";
import type { useSunglassesCustomiserState } from "../hooks/useSunglassesCustomiserState";
import { CustomiserPanel } from "./CustomiserPanel";
import { extrasBuilderOptions } from "../utils/builder-option-groups";
import {
  buildAddOnsLabel,
  SunglassesConfigurationSummary,
} from "./SunglassesConfigurationSummary";
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

const POLARIZED_CODE = "polarized";

export function SunglassesConfigColumn({
  flow,
  state,
  currencyCode,
  onSaveDesign,
  onAddToCart,
  saving = false,
  className,
}: SunglassesConfigColumnProps) {
  const {
    frameSku,
    config,
    isOptionEnabled,
    selectedTintEntry,
    sunglassesCatalog,
    requiresManualFollowUp,
    totalPrice,
  } = state;

  const polarizedOption = sunglassesCatalog.getOptionByCode(POLARIZED_CODE);
  const extrasOptions = extrasBuilderOptions(sunglassesCatalog.builderOptions);

  const prescriptionLabel = requiresManualFollowUp ? "Required" : "None";
  const addOnsLabel = buildAddOnsLabel(extrasOptions, config.options);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-border bg-background md:border-t lg:border-l lg:border-t-0",
        className,
      )}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        data-scroll-isolate="true"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="hidden shrink-0 border-b border-border/60 px-4 py-4 sm:px-5 sm:py-5 lg:block">
          <SunglassesHorizontalSteps current={flow.step} onSelect={flow.goTo} />
        </div>

        <div className="px-4 py-4 sm:px-5 sm:py-5">
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
              frameName={frameSku.name}
              lensTint={config.tint.name || "—"}
              polarized={isOptionEnabled(POLARIZED_CODE)}
              polarizedLabel={polarizedOption?.label}
              prescription={prescriptionLabel}
              addOnsLabel={addOnsLabel}
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
