import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";
import type { FrameOption } from "@/lib/luxe-data";

interface PreviewStepPanelProps {
  frameSku: FrameOption;
  tintName: string;
  selectedTintEntry: LensTintEntry | null;
  builderOptions: BuilderOptionEntry[];
  selectedOptions: Record<string, boolean>;
  requiresManualFollowUp: boolean;
  basePrice: number;
  totalPrice: number;
  lensDisclaimer: string;
}

export function PreviewStepPanel({
  frameSku,
  tintName,
  selectedTintEntry,
  builderOptions,
  selectedOptions,
  requiresManualFollowUp,
  basePrice,
  totalPrice,
  lensDisclaimer,
}: PreviewStepPanelProps) {
  const selectedAddOns = builderOptions.filter((o) => selectedOptions[o.code]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">Final preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">Review your configuration before checkout.</p>
      </div>

      <div className="glass-panel space-y-4 rounded-[2rem] p-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frame</span>
          <span className="font-medium text-foreground">
            {frameSku.name}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Lens tint</span>
          <span className="font-medium text-foreground">
            {tintName}
            {selectedTintEntry && selectedTintEntry.priceSurcharge > 0
              ? ` (+$${selectedTintEntry.priceSurcharge})`
              : ""}
          </span>
        </div>
        {selectedAddOns.map((option) => (
          <div key={option.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{option.label}</span>
            <span className="font-medium text-foreground">Yes (+${option.priceSurcharge})</span>
          </div>
        ))}
        {selectedAddOns.length === 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Add-ons</span>
            <span className="font-medium text-foreground">None</span>
          </div>
        )}
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</span>
          <span className="font-display text-3xl font-black text-primary">${totalPrice}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Base frame ${basePrice}
          {selectedTintEntry && selectedTintEntry.priceSurcharge > 0
            ? ` · tint +$${selectedTintEntry.priceSurcharge}`
            : ""}
          {selectedAddOns.map((o) => ` · ${o.label.toLowerCase()} +$${o.priceSurcharge}`).join("")}
        </p>
      </div>

      {requiresManualFollowUp && (
        <Alert variant="default">
          <AlertDescription className="text-sm font-medium">
            Prescription selected — order flagged for manual follow-up before confirmation.
          </AlertDescription>
        </Alert>
      )}

      {lensDisclaimer && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
      )}
    </div>
  );
}
