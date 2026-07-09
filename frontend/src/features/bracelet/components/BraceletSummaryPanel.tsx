import { ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { BraceletBuilderSummary } from "@bino-foundry/shared/types";
import { formatCurrency } from "@bino-foundry/shared/currency";

import { Button } from "@/components/ui/button";
import { BuilderSaveStatus } from "@/features/designs/BuilderSaveStatus";
import type { DesignAutoSaveStatus } from "@/features/designs/design-autosave-controller";
import { BUILDER_COPY } from "@/layouts/builder-copy";
import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";
import { formatPricingLineItemLabel } from "../pricing";
import { StrandCapacityCard } from "./StrandCapacityCard";
import { SummaryInfoCard } from "./SummaryInfoCard";

interface BraceletSummaryPanelProps {
  summary: BraceletBuilderSummary;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  onAddToCart?: () => void;
  saveDisabled?: boolean;
  autoSaveStatus?: DesignAutoSaveStatus;
  autoSaveVisible?: boolean;
  signedIn?: boolean;
  /** When true, outer title bar is omitted (parent layout supplies sidebar chrome). */
  embedded?: boolean;
}

function CostLine({
  label,
  amount,
  currencyCode,
}: {
  label: string;
  amount: number;
  currencyCode: string;
}) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="truncate text-foreground/90">{label}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {formatCurrency(amount, currencyCode)}
      </span>
    </div>
  );
}

export function BraceletSummaryPanel({
  summary,
  className,
  collapsible = false,
  defaultOpen = true,
  onAddToCart,
  saveDisabled = false,
  autoSaveStatus = "idle",
  autoSaveVisible = false,
  signedIn = false,
  embedded = false,
}: BraceletSummaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { pricing } = summary;
  const strandA = summary.strands[0];
  const strandB = summary.twinning ? summary.strands[1] : undefined;

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart();
      return;
    }
    toast.message(BUILDER_COPY.addToCartComingSoon);
  };

  const body = (
    <div className="space-y-3">
      <SummaryInfoCard title={BRACELET_COPY.costBreakdown}>
        {pricing.placedCount === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <div className="space-y-1.5">
            {pricing.lineItems.map((item) => (
              <CostLine
                key={item.offerKey}
                label={formatPricingLineItemLabel(item)}
                amount={item.lineTotal}
                currencyCode={pricing.currencyCode}
              />
            ))}
            <div className="border-t border-border/50 pt-1.5">
              <CostLine
                label={BRACELET_COPY.subtotal}
                amount={pricing.subtotal}
                currencyCode={pricing.currencyCode}
              />
            </div>
          </div>
        )}
      </SummaryInfoCard>

      <div className="rounded-xl border border-border/45 bg-card/50 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="type-body text-sm text-foreground">{BRACELET_COPY.estimatedTotal}</span>
          <span className="type-price text-xl text-foreground">
            {formatCurrency(pricing.total, pricing.currencyCode)}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          {BRACELET_COPY.priceNote(pricing.currencyCode)}
        </p>
      </div>

      {strandA ? (
        <SummaryInfoCard title={BRACELET_COPY.configurationSummary}>
          <div className="space-y-2">
            <StrandCapacityCard strand={strandA} showStrandLabel={summary.twinning} compact />
            {strandB ? <StrandCapacityCard strand={strandB} showStrandLabel compact /> : null}
          </div>
        </SummaryInfoCard>
      ) : null}

      <div className="space-y-1.5 pt-0.5">
        <BuilderSaveStatus
          status={autoSaveStatus}
          visible={autoSaveVisible}
          signedIn={signedIn}
        />
        <Button type="button" className="w-full" size="default" disabled={saveDisabled} onClick={handleAddToCart}>
          <ShoppingBag className="mr-2 h-3.5 w-3.5" />
          {BRACELET_COPY.addToCart}
        </Button>
      </div>
    </div>
  );

  const panelHeader = (
    <div className="shrink-0 border-b border-border/80 px-2.5 py-2 lg:px-3 lg:py-2.5">
      <h2 className="type-h3 text-sm text-foreground/90">{BRACELET_COPY.summaryTitle}</h2>
    </div>
  );

  if (!collapsible) {
    return (
      <aside className={cn("flex h-full w-full flex-col bg-background", className)}>
        {!embedded ? panelHeader : null}
        <div className="flex-1 overflow-y-auto px-2 py-2 lg:px-2.5 lg:py-2.5">{body}</div>
      </aside>
    );
  }

  return (
    <div className={cn("border-t border-border/50 bg-background/40", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <span className="type-h3 text-sm text-foreground/90">{BRACELET_COPY.summaryTitle}</span>
          <span className="type-price ml-2 text-body text-primary">
            {formatCurrency(pricing.total, pricing.currencyCode)}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <div
          className="max-h-[45vh] overflow-y-auto px-3 pb-3"
          data-scroll-isolate="true"
          onWheel={(e) => e.stopPropagation()}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
}
