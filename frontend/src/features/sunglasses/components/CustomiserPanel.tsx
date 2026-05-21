import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CustomiserStep } from "../constants";
import { useCustomiserFlow } from "../hooks/useCustomiserFlow";
import type { useSunglassesCustomiserState } from "../hooks/useSunglassesCustomiserState";
import { FrameStepPanel } from "./steps/FrameStepPanel";
import { LensStepPanel } from "./steps/LensStepPanel";
import { OptionsStepPanel } from "./steps/OptionsStepPanel";
import { PreviewStepPanel } from "./steps/PreviewStepPanel";

type CustomiserState = ReturnType<typeof useSunglassesCustomiserState>;

interface CustomiserPanelProps {
  flow: ReturnType<typeof useCustomiserFlow>;
  state: CustomiserState;
  className?: string;
}

const POLARIZED_CODE = "polarized";

export function CustomiserPanel({ flow, state, className }: CustomiserPanelProps) {
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
  const optionsStepChoices = sunglassesCatalog.builderOptions.filter(
    (o) => o.code !== POLARIZED_CODE,
  );

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
    options: (
      <OptionsStepPanel
        builderOptions={optionsStepChoices}
        selectedOptions={config.options}
        requiresManualFollowUp={requiresManualFollowUp}
        onOptionChange={setOption}
      />
    ),
    preview: (
      <PreviewStepPanel
        frameSku={frameSku}
        tintName={config.tint.name}
        selectedTintEntry={selectedTintEntry}
        builderOptions={sunglassesCatalog.builderOptions}
        selectedOptions={config.options}
        requiresManualFollowUp={requiresManualFollowUp}
        basePrice={frameSku.price}
        totalPrice={totalPrice}
        lensDisclaimer={sunglassesCatalog.lensDisclaimer}
      />
    ),
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        className="customiser-options-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5"
        aria-label="Customiser options"
      >
        <div className="pb-2">{stepContent[flow.step]}</div>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-border/80 pt-3">
        <Button type="button" variant="outline" size="sm" disabled={flow.isFirst} onClick={flow.goBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        {!flow.isLast ? (
          <Button type="button" size="sm" onClick={flow.goNext}>
            Continue
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" size="sm" disabled className="opacity-60">
            Ready to order
          </Button>
        )}
      </div>
    </div>
  );
}
