import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BuilderOptionEntry } from "@/types/sunglasses-catalog";

import { formatCurrencySurcharge } from "@bino-foundry/shared/currency";

import { SUNGLASSES_COPY } from "../../copy";

interface ExtrasStepPanelProps {
  extrasOptions: BuilderOptionEntry[];
  selectedOptions: Record<string, boolean>;
  currencyCode: string;
  onOptionChange: (code: string, enabled: boolean) => void;
}

export function ExtrasStepPanel({
  extrasOptions,
  selectedOptions,
  currencyCode,
  onOptionChange,
}: ExtrasStepPanelProps) {
  if (extrasOptions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-h3">{SUNGLASSES_COPY.addOnsStepTitle}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{SUNGLASSES_COPY.addOnsStepIntro}</p>
      </div>

      <div className="space-y-2">
        {extrasOptions.map((option) => (
          <div
            key={option.id}
            className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-3"
          >
            <div className="space-y-1 pr-4">
              <Label htmlFor={`extras-option-${option.code}`} className="font-medium text-foreground">
                {option.label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {formatCurrencySurcharge(option.priceSurcharge, currencyCode)}
                {option.description ? ` · ${option.description}` : ""}
              </p>
              {option.tooltipText ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline underline-offset-2"
                    >
                      Details
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-center">
                    {option.tooltipText}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <Switch
              id={`extras-option-${option.code}`}
              checked={Boolean(selectedOptions[option.code])}
              onCheckedChange={(value) => onOptionChange(option.code, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
