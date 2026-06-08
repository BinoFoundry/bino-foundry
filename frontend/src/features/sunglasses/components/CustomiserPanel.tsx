import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { cn } from "@/lib/utils";

import type { CustomiserStep } from "../constants";
import { useCustomiserFlow } from "../hooks/useCustomiserFlow";
import type { useSunglassesCustomiserState } from "../hooks/useSunglassesCustomiserState";
import { ExtrasStepPanel } from "./steps/ExtrasStepPanel";
import { FrameStepPanel } from "./steps/FrameStepPanel";
import { LensStepPanel } from "./steps/LensStepPanel";
import { PreviewStepPanel } from "./steps/PreviewStepPanel";
import { RxStepPanel } from "./steps/RxStepPanel";
import { extrasBuilderOptions, rxBuilderOptions } from "../utils/builder-option-groups";

type CustomiserState = ReturnType<typeof useSunglassesCustomiserState>;

interface CustomiserPanelProps {
  flow: ReturnType<typeof useCustomiserFlow>;
  state: CustomiserState;
  className?: string;
  currencyCode?: string;
  /** Hide back/continue footer when navigation lives in the summary panel. */
  showFooter?: boolean;
  onRequestQuote?: () => void;
}

const POLARIZED_CODE = "polarized";

export function CustomiserPanel({
  flow,
  state,
  className,
  currencyCode = "USD",
  showFooter = true,
  onRequestQuote: onRequestQuoteExternal,
}: CustomiserPanelProps) {
  const {
    frames,
    frameSku,
    selectFrameSku,
    config,
    setOption,
    isOptionEnabled,
    selectTintById,
    activeTintId,
    selectedTintEntry,
    sunglassesCatalog,
    requiresManualFollowUp,
    totalPrice,
  } = state;

  const polarizedOption = sunglassesCatalog.getOptionByCode(POLARIZED_CODE);
  const rxOptions = rxBuilderOptions(sunglassesCatalog.builderOptions);
  const extrasOptions = extrasBuilderOptions(sunglassesCatalog.builderOptions);
  const nonLensOptions = [...rxOptions, ...extrasOptions];

  const buildQuoteSummary = () => {
    const lines = [
      `Frame: ${frameSku.name} ($${frameSku.price})`,
      `Lens: ${isOptionEnabled(POLARIZED_CODE) ? polarizedOption?.label ?? "Polarised" : "Standard (non-polarised)"}`,
      `Tint: ${config.tint.name}${selectedTintEntry ? ` (${selectedTintEntry.code})` : ""}`,
      ...nonLensOptions
        .filter((o) => isOptionEnabled(o.code))
        .map((o) => `${o.label}: yes (+$${o.priceSurcharge})`),
      `Total: $${totalPrice} ${currencyCode}`,
    ];
    return lines.join("\n");
  };

  const handleRequestQuote = async () => {
    if (onRequestQuoteExternal) {
      onRequestQuoteExternal();
      return;
    }
    const summary = buildQuoteSummary();
    try {
      await navigator.clipboard.writeText(summary);
      toast.success(
        requiresManualFollowUp
          ? CUSTOMER_COPY.quoteCopiedPrescription
          : CUSTOMER_COPY.quoteCopiedReady,
      );
    } catch {
      toast.message(CUSTOMER_COPY.quoteCopyFallbackTitle, { description: summary });
    }
  };

  const stepContent: Record<CustomiserStep, ReactNode> = {
    frame: (
      <FrameStepPanel
        frames={frames}
        selectedFrameId={frameSku.id}
        onSelectFrame={selectFrameSku}
      />
    ),
    lens: (
      <LensStepPanel
        classicTints={sunglassesCatalog.classicTints}
        gradientTints={sunglassesCatalog.gradientTints}
        polarizedOption={polarizedOption}
        polarized={isOptionEnabled(POLARIZED_CODE)}
        activeTintId={activeTintId}
        lensDisclaimer={sunglassesCatalog.lensDisclaimer}
        onPolarizedChange={(value) => setOption(POLARIZED_CODE, value)}
        onSelectTint={selectTintById}
      />
    ),
    rx: (
      <RxStepPanel
        rxOptions={rxOptions}
        selectedOptions={config.options}
        requiresManualFollowUp={requiresManualFollowUp}
        onOptionChange={setOption}
      />
    ),
    extras: (
      <ExtrasStepPanel
        extrasOptions={extrasOptions}
        selectedOptions={config.options}
        onOptionChange={setOption}
      />
    ),
    preview: (
      <PreviewStepPanel
        frameSku={frameSku}
        tintName={config.tint.name}
        selectedTintEntry={selectedTintEntry}
        polarized={isOptionEnabled(POLARIZED_CODE)}
        polarizedLabel={polarizedOption?.label}
        polarizedSurcharge={polarizedOption?.priceSurcharge}
        builderOptions={sunglassesCatalog.builderOptions}
        selectedOptions={config.options}
        requiresManualFollowUp={requiresManualFollowUp}
        basePrice={frameSku.price}
        totalPrice={totalPrice}
        lensDisclaimer={sunglassesCatalog.lensDisclaimer}
        onRequestQuote={() => void handleRequestQuote()}
      />
    ),
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        className="customiser-options-scroll admin-scroll-pane min-h-0 flex-1 px-0.5"
        aria-label="Customiser options"
      >
        <div className="pb-2">{stepContent[flow.step]}</div>
      </div>

      {showFooter ? (
        <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-border/80 pt-3">
          <Button type="button" variant="secondary" size="sm" disabled={flow.isFirst} onClick={flow.goBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          {!flow.isLast ? (
            <Button type="button" size="sm" onClick={flow.goNext}>
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => void handleRequestQuote()}>
              {requiresManualFollowUp ? "Request consultation" : "Request quote"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
