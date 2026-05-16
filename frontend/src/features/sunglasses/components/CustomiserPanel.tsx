import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

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
}

const POLARIZED_CODE = "polarized";

export function CustomiserPanel({ flow, state }: CustomiserPanelProps) {
  const {
    frames,
    frameSku,
    selectFrameSku,
    config,
    setFrame,
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
        frameColors={sunglassesCatalog.frameColors}
        selectedFrameId={frameSku.id}
        selectedFrameColor={config.frame}
        onSelectFrame={selectFrameSku}
        onSelectColor={setFrame}
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
        frameColorName={config.frame.name}
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-1">{stepContent[flow.step]}</div>

      <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-border pt-4">
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
