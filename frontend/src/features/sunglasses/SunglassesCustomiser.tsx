import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorState } from "@/components/common";
import { LoadingState } from "@/components/common";

import { CustomiserPanel } from "./components/CustomiserPanel";
import { DisplayColumn } from "./components/DisplayColumn";
import { StepProgress } from "./components/StepProgress";
import type { CustomiserStep } from "./constants";
import { CUSTOMISER_STEPS } from "./constants";
import { useCustomiserFlow } from "./hooks/useCustomiserFlow";
import { useSunglassesCustomiserState } from "./hooks/useSunglassesCustomiserState";

interface SunglassesCustomiserProps {
  onPriceChange: (price: number) => void;
}

export function SunglassesCustomiser({ onPriceChange }: SunglassesCustomiserProps) {
  const state = useSunglassesCustomiserState(onPriceChange);
  const flow = useCustomiserFlow();
  const { sunglassesCatalog } = state;

  if (sunglassesCatalog.isHydrating && sunglassesCatalog.lensTints.length === 0) {
    return <LoadingState label="Loading sunglasses options…" className="h-full" />;
  }

  if (sunglassesCatalog.hydrateError && sunglassesCatalog.lensTints.length === 0) {
    return (
      <ErrorState
        message={sunglassesCatalog.hydrateError}
        onRetry={() => void sunglassesCatalog.refreshFromApi()}
        className="m-6"
      />
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden lg:grid lg:grid-cols-12 lg:gap-8 lg:p-6">
        {/* Mobile: step tabs + stacked layout */}
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:hidden">
          <StepProgress current={flow.step} />
          <Tabs
            value={flow.step}
            onValueChange={(value) => flow.goTo(value as CustomiserStep)}
          >
            <TabsList className="grid w-full grid-cols-4">
              {CUSTOMISER_STEPS.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="text-[10px] px-1">
                  {s.shortLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Product display */}
        <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 lg:col-span-7 lg:px-0 lg:pb-0">
          <DisplayColumn
            config={state.compositorConfig}
            summaryText={state.summaryText}
            totalPrice={state.totalPrice}
            lensDisclaimer={sunglassesCatalog.lensDisclaimer}
            showSummaryCard={flow.step !== "preview"}
          />
        </section>

        {/* Customisation panel — desktop */}
        <aside className="hidden min-h-0 flex-col border-t border-border bg-card/50 p-4 lg:col-span-5 lg:flex lg:rounded-[2rem] lg:border lg:p-6">
          <StepProgress current={flow.step} className="mb-6" />
          <CustomiserPanel flow={flow} state={state} />
        </aside>

        {/* Mobile panel below display */}
        <section className="border-t border-border bg-card/50 p-4 lg:hidden">
          <CustomiserPanel flow={flow} state={state} />
        </section>
      </div>
    </TooltipProvider>
  );
}

export default SunglassesCustomiser;
