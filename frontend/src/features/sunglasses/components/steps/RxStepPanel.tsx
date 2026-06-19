import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BuilderOptionEntry } from "@/types/sunglasses-catalog";

import { formatCurrencySurcharge } from "@bino-foundry/shared/currency";

import { SUNGLASSES_COPY, SUNGLASSES_PRICE } from "../../copy";

interface RxStepPanelProps {
  rxOptions: BuilderOptionEntry[];
  selectedOptions: Record<string, boolean>;
  requiresManualFollowUp: boolean;
  currencyCode: string;
  onOptionChange: (code: string, enabled: boolean) => void;
}

export function RxStepPanel({
  rxOptions,
  selectedOptions,
  requiresManualFollowUp,
  currencyCode,
  onOptionChange,
}: RxStepPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-h3">{SUNGLASSES_COPY.rxStepTitle}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{SUNGLASSES_COPY.rxStepIntro}</p>
      </div>

      {rxOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Prescription lenses are not available for this catalogue.</p>
      ) : (
        <div className="space-y-2">
          {rxOptions.map((option) => (
            <div
              key={option.id}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-3"
            >
              <div className="space-y-1 pr-4">
                <Label htmlFor={`rx-option-${option.code}`} className="font-medium text-foreground">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  <span className={SUNGLASSES_PRICE.surcharge}>
                    {formatCurrencySurcharge(option.priceSurcharge, currencyCode)}
                  </span>
                  {option.description ? ` · ${option.description}` : ""}
                </p>
                {option.tooltipText ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline underline-offset-2"
                      >
                        {SUNGLASSES_COPY.degreeLimitations}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-center">
                      {option.tooltipText}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <Switch
                id={`rx-option-${option.code}`}
                checked={Boolean(selectedOptions[option.code])}
                onCheckedChange={(value) => onOptionChange(option.code, value)}
              />
            </div>
          ))}
        </div>
      )}

      {requiresManualFollowUp ? (
        <Alert>
          <AlertDescription className="text-sm">
            Your order will be flagged for manual follow-up. We will contact you to verify prescription power and fit
            within 1–2 business days.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
