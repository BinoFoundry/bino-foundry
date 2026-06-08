import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BuilderOptionEntry } from "@/types/sunglasses-catalog";

interface RxStepPanelProps {
  rxOptions: BuilderOptionEntry[];
  selectedOptions: Record<string, boolean>;
  requiresManualFollowUp: boolean;
  onOptionChange: (code: string, enabled: boolean) => void;
}

export function RxStepPanel({
  rxOptions,
  selectedOptions,
  requiresManualFollowUp,
  onOptionChange,
}: RxStepPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-h3">Prescription lenses</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Select prescription lenses if needed. Our team will confirm your prescription details before production.
        </p>
      </div>

      {rxOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Prescription lenses are not available for this catalogue.</p>
      ) : (
        <div className="space-y-2">
          {rxOptions.map((option) => (
            <div
              key={option.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <div className="space-y-1 pr-4">
                <Label htmlFor={`rx-option-${option.code}`} className="font-medium text-foreground">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  +${option.priceSurcharge}
                  {option.description ? ` · ${option.description}` : ""}
                </p>
                {option.tooltipText ? (
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
