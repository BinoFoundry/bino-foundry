import { Minus, Plus } from "lucide-react";
import { useMemo } from "react";

import type { BraceletPreparationSelection, HowWePrepareOption } from "@bino-foundry/shared/types";
import { formatCurrency } from "@bino-foundry/shared/currency";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";

interface HowWePrepareSectionProps {
  options: HowWePrepareOption[];
  selection: BraceletPreparationSelection | null;
  onSelect: (slug: string) => void;
  onQuantityChange: (quantity: number) => void;
  estimatedTotal: number;
  currencyCode: string;
}

function activeOptions(options: HowWePrepareOption[]): HowWePrepareOption[] {
  return [...options]
    .filter((o) => o.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

export function HowWePrepareSection({
  options,
  selection,
  onSelect,
  onQuantityChange,
  estimatedTotal,
  currencyCode,
}: HowWePrepareSectionProps) {
  const visible = useMemo(() => activeOptions(options), [options]);
  const selected = useMemo(
    () => visible.find((o) => o.slug === selection?.optionSlug) ?? null,
    [visible, selection?.optionSlug],
  );

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {BRACELET_COPY.howWePrepareTitle}
      </p>

      <div className="space-y-1.5" role="radiogroup" aria-label={BRACELET_COPY.howWePrepareTitle}>
        {visible.map((option) => {
          const checked = selection?.optionSlug === option.slug;
          const priceDisplay = formatCurrency(option.price, currencyCode);

          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                checked
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/45 bg-card/50 hover:bg-card/70",
              )}
            >
              <input
                type="radio"
                name="how-we-prepare"
                className="mt-1 shrink-0"
                checked={checked}
                onChange={() => onSelect(option.slug)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="text-[11px] font-medium text-foreground">{option.name}</span>
                    {option.badge ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        {option.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {priceDisplay}
                  </span>
                </span>
                {option.shortDescription ? (
                  <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                    {option.shortDescription}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {selected?.quantityEnabled && selection ? (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
          <span className="text-[11px] text-foreground/90">{BRACELET_COPY.preparationQuantity}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={selection.quantity <= selected.minimumQuantity}
              onClick={() => onQuantityChange(selection.quantity - 1)}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="min-w-[1.5rem] text-center text-sm tabular-nums">{selection.quantity}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={selection.quantity >= selected.maximumQuantity}
              onClick={() => onQuantityChange(selection.quantity + 1)}
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : null}

      {selected && selected.benefits.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-border/35 bg-background/30 px-3 py-2">
          {selected.benefits.map((benefit) => (
            <li key={benefit} className="flex gap-2 text-[10px] leading-snug text-muted-foreground">
              <span className="text-primary" aria-hidden>
                •
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {selected &&
      (selected.highlightTitle.trim() || selected.highlightDescription.trim()) ? (
        <div className="rounded-xl border border-border/45 bg-card/50 px-3 py-2.5">
          {selected.highlightTitle.trim() ? (
            <p className="text-[11px] font-medium text-foreground">{selected.highlightTitle}</p>
          ) : null}
          {selected.highlightDescription.trim() ? (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              {selected.highlightDescription}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border/45 bg-card/50 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="type-body text-sm text-foreground">{BRACELET_COPY.estimatedTotal}</span>
          <span className="type-price text-xl text-foreground">
            {formatCurrency(estimatedTotal, currencyCode)}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          {BRACELET_COPY.priceNote(currencyCode)}
        </p>
      </div>
    </div>
  );
}
