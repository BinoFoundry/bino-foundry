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
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">Additional options</h3>
        <p className="mt-1 text-sm text-muted-foreground">Prescription orders are reviewed before confirmation.</p>
      </div>

      {builderOptions.map((option) => (
        <div
          key={option.id}
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
        >
          <div className="space-y-1 pr-4">
            <Label htmlFor={`option-${option.code}`} className="font-semibold">
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
