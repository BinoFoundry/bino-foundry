import { Save, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BUILDER_COPY } from "@/layouts/builder-copy";
import { cn } from "@/lib/utils";
import type { BuilderOptionEntry } from "@/types/sunglasses-catalog";

const EMPTY = "—";

interface SunglassesConfigurationSummaryProps {
  frameName: string;
  lensTint: string;
  polarized: boolean;
  polarizedLabel?: string;
  prescription: string;
  addOnsLabel: string;
  totalPrice: number;
  currencyCode: string;
  onSaveDesign?: () => void;
  saving?: boolean;
  className?: string;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || EMPTY}</span>
    </div>
  );
}

export function buildAddOnsLabel(
  builderOptions: BuilderOptionEntry[],
  selectedOptions: Record<string, boolean>,
  polarizedCode = "polarized",
): string {
  const selected = builderOptions
    .filter((o) => o.code !== polarizedCode && selectedOptions[o.code])
    .map((o) => o.label);
  return selected.length ? selected.join(", ") : EMPTY;
}

export function SunglassesConfigurationSummary({
  frameName,
  lensTint,
  polarized,
  polarizedLabel,
  prescription,
  addOnsLabel,
  totalPrice,
  currencyCode,
  onSaveDesign,
  saving = false,
  className,
}: SunglassesConfigurationSummaryProps) {
  const handleAddToCart = () => {
    toast.message(BUILDER_COPY.addToCartComingSoon);
  };

  const handleSave = () => {
    if (onSaveDesign) {
      onSaveDesign();
      return;
    }
    toast.message("Save design will be available when checkout launches.");
  };

  return (
    <section className={cn("space-y-4", className)}>
      <h3 className="type-h3">Your Configuration</h3>

      <div className="space-y-2.5 rounded-xl border border-border/60 bg-background/60 p-4">
        <SummaryRow label="Frame" value={frameName} />
        <SummaryRow label="Lens Tint" value={lensTint} />
        <SummaryRow
          label="Polarized"
          value={polarized ? polarizedLabel ?? "Yes" : "No"}
        />
        <SummaryRow label="Prescription" value={prescription} />
        <SummaryRow label="Add-ons" value={addOnsLabel} />
      </div>

      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="type-body text-foreground">Estimated Total</span>
        <span className="type-price text-2xl text-foreground">
          ${totalPrice.toFixed(2)}
          <span className="type-label ml-1 text-sm text-muted-foreground">{currencyCode}</span>
        </span>
      </div>

      <Separator />

      <div className="space-y-2">
        <Button type="button" className="w-full" size="lg" onClick={handleAddToCart}>
          <ShoppingBag className="mr-2 h-4 w-4" />
          {BUILDER_COPY.addToCart}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          size="lg"
          disabled={saving}
          onClick={handleSave}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save Design"}
        </Button>
      </div>
    </section>
  );
}
