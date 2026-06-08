import { useCallback, useState } from "react";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorState, LoadingState } from "@/components/common";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { useSiteGeneralSettings } from "@/hooks/use-site-settings";

import { SunglassesConfigColumn } from "./components/SunglassesConfigColumn";
import { SunglassesHorizontalSteps } from "./components/SunglassesHorizontalSteps";
import { SunglassesPreviewPanel } from "./components/SunglassesPreviewPanel";
import { useCustomiserFlow } from "./hooks/useCustomiserFlow";
import { useSunglassesCustomiserState } from "./hooks/useSunglassesCustomiserState";
import { SunglassesBuilderLayout } from "./layout/SunglassesBuilderLayout";

interface SunglassesCustomiserProps {
  onPriceChange: (price: number) => void;
}

export function SunglassesCustomiser({ onPriceChange }: SunglassesCustomiserProps) {
  const state = useSunglassesCustomiserState(onPriceChange);
  const flow = useCustomiserFlow();
  const { data: siteSettings } = useSiteGeneralSettings();
  const currencyCode = siteSettings.currencyCode;
  const { sunglassesCatalog } = state;
  const [saving, setSaving] = useState(false);

  const buildConfigurationSummary = useCallback(() => {
    const polarized = state.isOptionEnabled("polarized");
    const polarizedOption = sunglassesCatalog.getOptionByCode("polarized");
    return [
      `Frame: ${state.frameSku.name} ($${state.frameSku.price})`,
      `Lens: ${polarized ? polarizedOption?.label ?? "Polarised" : "Standard (non-polarised)"}`,
      `Tint: ${state.config.tint.name}${state.selectedTintEntry ? ` (${state.selectedTintEntry.code})` : ""}`,
      ...sunglassesCatalog.builderOptions
        .filter((o) => o.code !== "polarized" && state.isOptionEnabled(o.code))
        .map((o) => `${o.label}: yes (+$${o.priceSurcharge})`),
      `Total: $${state.totalPrice} ${currencyCode}`,
    ].join("\n");
  }, [state, sunglassesCatalog, currencyCode]);

  const handleSaveDesign = useCallback(async () => {
    setSaving(true);
    const summary = buildConfigurationSummary();
    try {
      await navigator.clipboard.writeText(summary);
      toast.success(CUSTOMER_COPY.saveDesignSuccess("sunglasses"));
    } catch {
      toast.message(CUSTOMER_COPY.quoteCopyFallbackTitle, { description: summary });
    } finally {
      setSaving(false);
    }
  }, [buildConfigurationSummary]);

  if (sunglassesCatalog.isHydrating && sunglassesCatalog.lensTints.length === 0) {
    return <LoadingState label="Loading sunglasses options…" className="h-full" />;
  }

  if (sunglassesCatalog.hydrateError && sunglassesCatalog.lensTints.length === 0) {
    return (
      <ErrorState
        message={CUSTOMER_COPY.sunglassesLoadFailed}
        onRetry={() => void sunglassesCatalog.refreshFromApi()}
        className="m-6"
      />
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <SunglassesBuilderLayout
        mobileSteps={<SunglassesHorizontalSteps current={flow.step} onSelect={flow.goTo} />}
        preview={<SunglassesPreviewPanel config={state.compositorConfig} />}
        configuration={
          <SunglassesConfigColumn
            flow={flow}
            state={state}
            currencyCode={currencyCode}
            onSaveDesign={() => void handleSaveDesign()}
            saving={saving}
          />
        }
      />
    </TooltipProvider>
  );
}

export default SunglassesCustomiser;
