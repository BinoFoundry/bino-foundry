import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BuilderOptionEntry } from "@/types/sunglasses-catalog";

interface OptionsStepPanelProps {
  builderOptions: BuilderOptionEntry[];
  selectedOptions: Record<string, boolean>;
  requiresManualFollowUp: boolean;
  onOptionChange: (code: string, enabled: boolean) => void;
}

export function OptionsStepPanel({
  builderOptions,
  selectedOptions,
  requiresManualFollowUp,
  onOptionChange,
}: OptionsStepPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-h3">Additional options</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Prescription orders are reviewed before confirmation.</p>
      </div>

      <div className="space-y-2">
        {builderOptions.map((option) => (
          <div
            key={option.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
          >
          <div className="space-y-1 pr-4">
            <Label htmlFor={`option-${option.code}`} className="font-medium text-foreground">
              {option.label}
            </Label>
            <p className="text-xs text-muted-foreground">
              +${option.priceSurcharge}
              {option.description ? ` · ${option.description}` : ""}
            </p>
            {option.tooltipText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary underline underline-offset-2"
                  >
                    degree limitations
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-center">
                  {option.tooltipText}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Switch
            id={`option-${option.code}`}
            checked={Boolean(selectedOptions[option.code])}
            onCheckedChange={(value) => onOptionChange(option.code, value)}
          />
          </div>
        ))}

        {builderOptions.length === 0 && (
          <p className="text-sm text-muted-foreground">No builder options configured in admin.</p>
        )}
      </div>

      {requiresManualFollowUp && (
        <Alert>
          <AlertDescription className="text-sm">
            Your order will be flagged for manual follow-up before we confirm production. Our team will
            contact you to verify details within 1–2 business days.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
