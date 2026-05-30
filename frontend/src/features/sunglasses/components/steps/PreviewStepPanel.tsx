import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";
import type { FrameOption } from "@/lib/luxe-data";

interface PreviewStepPanelProps {
  frameSku: FrameOption;
  tintName: string;
  selectedTintEntry: LensTintEntry | null;
  polarized: boolean;
  polarizedLabel?: string;
  polarizedSurcharge?: number;
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
  polarized,
  polarizedLabel,
  polarizedSurcharge = 0,
  builderOptions,
  selectedOptions,
  requiresManualFollowUp,
  basePrice,
  totalPrice,
  lensDisclaimer,
}: PreviewStepPanelProps) {
  const otherAddOns = builderOptions.filter(
    (o) => o.code !== "polarized" && selectedOptions[o.code],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">Final preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">Review your configuration before requesting a quote.</p>
      </div>

      <div className="glass-panel space-y-4 rounded-[2rem] p-6">
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Frame</span>
          <span className="text-right font-medium text-foreground">
            {frameSku.name}
            <span className="block text-xs text-muted-foreground">${basePrice}</span>
          </span>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Lens type</span>
          <span className="text-right font-medium text-foreground">
            {polarized ? polarizedLabel ?? "Polarised" : "Standard (non-polarised)"}
            {polarized && polarizedSurcharge > 0 ? (
              <span className="block text-xs text-muted-foreground">+${polarizedSurcharge}</span>
            ) : null}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Lens tint</span>
          <span className="text-right font-medium text-foreground">
            {tintName}
            {selectedTintEntry ? (
              <span className="block font-mono text-[10px] text-muted-foreground">
                {selectedTintEntry.code} · {selectedTintEntry.gradientTop}
                {selectedTintEntry.category === "gradient" &&
                selectedTintEntry.gradientBottom !== selectedTintEntry.gradientTop
                  ? ` → ${selectedTintEntry.gradientBottom}`
                  : ""}
              </span>
            ) : null}
            {selectedTintEntry && selectedTintEntry.priceSurcharge > 0 ? (
              <span className="block text-xs text-muted-foreground">+${selectedTintEntry.priceSurcharge}</span>
            ) : null}
          </span>
        </div>
        {otherAddOns.map((option) => (
          <div key={option.id} className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{option.label}</span>
            <span className="font-medium text-foreground">
              Yes
              {option.priceSurcharge > 0 ? ` (+$${option.priceSurcharge})` : ""}
            </span>
          </div>
        ))}
        {otherAddOns.length === 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Other add-ons</span>
            <span className="font-medium text-foreground">None</span>
          </div>
        )}
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</span>
          <span className="font-display text-3xl font-black text-primary">${totalPrice}</span>
        </div>
      </div>

      {requiresManualFollowUp && (
        <Alert variant="default">
          <AlertDescription className="text-sm font-medium">
            Prescription selected — our team will contact you to confirm lens details before any order is placed.
          </AlertDescription>
        </Alert>
      )}

      {lensDisclaimer && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
      )}
    </div>
  );
}
