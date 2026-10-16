import { Info } from "lucide-react";

import { formatCurrency } from "@bino-foundry/shared/currency";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { GlamOption } from "../glam-options";

interface GlamSectionProps {
  options: GlamOption[];
  /** Selected option id, or null for "no glam". */
  selection: string | null;
  onSelect: (id: string | null) => void;
  currencyCode: string;
}

/** The "i" preview control — shows the look's photo without toggling the radio. */
function GlamPreview({ option }: { option: GlamOption }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Preview ${option.name}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3 w-3" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="center"
        sideOffset={8}
        className="w-56 border-border/80 bg-popover p-2 text-sm shadow-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <img
          src={option.image}
          alt={option.name}
          loading="lazy"
          className="aspect-square w-full rounded-lg object-cover"
        />
        <p className="mt-1.5 text-[11px] font-medium text-foreground">{option.name}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          {option.description}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function GlamSection({ options, selection, onSelect, currencyCode }: GlamSectionProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        ✨ Glam it up
      </p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Add a gold finishing touch ✨ Tap the <span className="font-medium">ⓘ</span> to preview your
        options. We’ll confirm the exact design with you before finalising your order.
      </p>

      <div className="space-y-1.5" role="radiogroup" aria-label="Glam it up">
        {options.map((option) => {
          const checked = selection === option.id;
          return (
            <div
              key={option.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors",
                checked
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/45 bg-card/50 hover:bg-card/70",
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                <input
                  type="radio"
                  name="glam"
                  className="shrink-0"
                  checked={checked}
                  onChange={() => onSelect(option.id)}
                />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-foreground">
                    {option.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    +{formatCurrency(option.price, currencyCode)}
                  </span>
                </span>
              </label>

              <GlamPreview option={option} />
            </div>
          );
        })}

        <label
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
            selection === null
              ? "border-primary/50 bg-primary/5"
              : "border-border/45 bg-card/50 hover:bg-card/70",
          )}
        >
          <input
            type="radio"
            name="glam"
            className="shrink-0"
            checked={selection === null}
            onChange={() => onSelect(null)}
          />
          <span className="text-[11px] text-foreground/90">No thanks, keep it simple</span>
        </label>
      </div>
    </div>
  );
}
