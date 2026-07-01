import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BuilderSaveStatus } from "@/features/designs/BuilderSaveStatus";
import type { DesignAutoSaveStatus } from "@/features/designs/design-autosave-controller";
import { BUILDER_COPY } from "@/layouts/builder-copy";
import { cn } from "@/lib/utils";
import type { BuilderOptionEntry } from "@/types/sunglasses-catalog";

import { formatCurrency } from "@bino-foundry/shared/currency";
import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { SUNGLASSES_COPY, SUNGLASSES_PRICE } from "../copy";

const EMPTY = "—";

export interface ConfigurationSummaryProps {
  frameName: string;
  lensTint: string;
  polarized: boolean;
  polarizedLabel?: string;
  prescription: string;
  addOnsLabel: string;
}

interface SunglassesConfigurationSummaryProps {
  totalPrice: number;
  currencyCode: string;
  onAddToCart?: () => void;
  autoSaveStatus?: DesignAutoSaveStatus;
  autoSaveVisible?: boolean;
  signedIn?: boolean;
  className?: string;
}

export function hasSelectedAddOns(addOnsLabel: string): boolean {
  return Boolean(addOnsLabel && addOnsLabel !== EMPTY);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || EMPTY}</span>
    </div>
  );
}

export function ConfigurationSummaryCard({
  frameName,
  lensTint,
  polarized,
  polarizedLabel,
  prescription,
  addOnsLabel,
  showAddOns = true,
  className,
}: ConfigurationSummaryProps & { showAddOns?: boolean; className?: string }) {
  return (
    <section className={cn("space-y-2", className)}>
      <h4 className="type-h3 text-base">{SUNGLASSES_COPY.yourConfiguration}</h4>
      <div className="space-y-2.5 rounded-xl border border-border/60 bg-background/60 p-4">
        <SummaryRow label="Frame" value={frameName} />
        <SummaryRow label={SUNGLASSES_COPY.summaryTint} value={lensTint} />
        <SummaryRow
          label={SUNGLASSES_COPY.summaryPolarized}
          value={polarized ? polarizedLabel ?? "Yes" : "No"}
        />
        <SummaryRow label="Prescription" value={prescription} />
        {showAddOns && hasSelectedAddOns(addOnsLabel) ? (
          <SummaryRow label={SUNGLASSES_COPY.addOnsSectionTitle} value={addOnsLabel} />
        ) : null}
      </div>
    </section>
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
  totalPrice,
  currencyCode = DEFAULT_SITE_GENERAL_SETTINGS.currencyCode,
  onAddToCart,
  autoSaveStatus = "idle",
  autoSaveVisible = false,
  signedIn = false,
  className,
}: SunglassesConfigurationSummaryProps) {
  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart();
      return;
    }
    toast.message(BUILDER_COPY.addToCartComingSoon);
  };

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="type-body text-foreground">Estimated Total</span>
        <span className={SUNGLASSES_PRICE.total}>
          {formatCurrency(totalPrice, currencyCode)}
        </span>
      </div>

      <Separator />

      <div className="space-y-2">
        <BuilderSaveStatus
          status={autoSaveStatus}
          visible={autoSaveVisible}
          signedIn={signedIn}
        />
        <Button type="button" className="w-full" size="lg" onClick={handleAddToCart}>
          <ShoppingBag className="mr-2 h-4 w-4" />
          {BUILDER_COPY.addToCart}
        </Button>
      </div>
    </section>
  );
}
