import { ShoppingBag } from "lucide-react";
import { formatCurrency } from "@bino-foundry/shared/currency";
import type { BraceletStrandSummary } from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";
import { formatCapacityCm } from "../wrist-fit";

interface BraceletMobileStatusCardProps {
  strand: BraceletStrandSummary;
  totalPrice: number;
  currencyCode: string;
  twinning?: boolean;
  strandIndex?: number;
  onAddToCart: () => void;
  addDisabled?: boolean;
  className?: string;
}

/** Compact mobile status: progress ring · % full · remaining · price · Add. */
export function BraceletMobileStatusCard({
  strand,
  totalPrice,
  currencyCode,
  twinning = false,
  strandIndex = 1,
  onAddToCart,
  addDisabled = false,
  className,
}: BraceletMobileStatusCardProps) {
  const fillPercent = Math.min(100, Math.max(0, strand.capacityPercent));
  const displayPercent = strand.isOverCapacity ? strand.capacityPercent : Math.round(fillPercent);
  const remainingCm = strand.isOverCapacity
    ? formatCapacityCm(0)
    : formatCapacityCm(Math.max(0, strand.remainingMm));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, fillPercent / 100));

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-2.5 shadow-sm",
        strand.isOverCapacity && "border-destructive/35",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="relative h-11 w-11 shrink-0" aria-hidden>
          <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="4"
            />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke={
                strand.isOverCapacity
                  ? "hsl(var(--destructive))"
                  : "hsl(var(--primary))"
              }
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-300 ease-out"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-sm font-semibold tabular-nums",
              strand.isOverCapacity ? "text-destructive" : "text-foreground",
            )}
          >
            {BRACELET_COPY.mobileFullLabel(displayPercent)}
            {twinning ? ` · #${strandIndex}` : ""}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {BRACELET_COPY.mobileLeftLabel(remainingCm)}
          </p>
        </div>
      </div>

      <p className="type-price shrink-0 text-base text-foreground">
        {formatCurrency(totalPrice, currencyCode)}
      </p>

      <Button
        type="button"
        size="sm"
        className="h-10 shrink-0 gap-1.5 rounded-xl px-3"
        disabled={addDisabled}
        onClick={onAddToCart}
      >
        <ShoppingBag className="h-4 w-4" aria-hidden />
        {BRACELET_COPY.mobileAdd}
      </Button>
    </div>
  );
}
