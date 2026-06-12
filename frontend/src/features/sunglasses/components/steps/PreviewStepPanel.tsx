import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { SUNGLASSES_COPY } from "../../copy";
import {
  ConfigurationSummaryCard,
  hasSelectedAddOns,
  type ConfigurationSummaryProps,
} from "../SunglassesConfigurationSummary";

interface PreviewStepPanelProps extends ConfigurationSummaryProps {
  requiresManualFollowUp: boolean;
  lensDisclaimer: string;
}

export function PreviewStepPanel({
  requiresManualFollowUp,
  lensDisclaimer,
  ...summaryProps
}: PreviewStepPanelProps) {
  const showAddOns = hasSelectedAddOns(summaryProps.addOnsLabel);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-h3">{SUNGLASSES_COPY.reviewStepTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{SUNGLASSES_COPY.reviewStepIntro}</p>
      </div>

      <ConfigurationSummaryCard {...summaryProps} showAddOns={false} />

      {showAddOns ? (
        <section className="space-y-2">
          <h4 className="type-h3 text-base">{SUNGLASSES_COPY.addOnsSectionTitle}</h4>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-sm font-medium text-foreground">{summaryProps.addOnsLabel}</p>
          </div>
        </section>
      ) : null}

      {requiresManualFollowUp ? (
        <Alert>
          <AlertTitle>Prescription lenses</AlertTitle>
          <AlertDescription className="text-sm">
            You selected options that need a prescription. Our team will contact you to confirm lens power and fit
            before any order is placed.
          </AlertDescription>
        </Alert>
      ) : null}

      {lensDisclaimer ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
      ) : null}
    </div>
  );
}
