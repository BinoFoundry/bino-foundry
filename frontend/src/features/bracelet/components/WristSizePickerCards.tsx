import { cn } from "@/lib/utils";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import {
  formatWristSizeCm,
  wristSizeDescriptor,
} from "../wrist-size-display";

type WristSizePickerVariant = "onboarding" | "inline";

interface WristSizePickerCardsProps {
  label?: string;
  sizes: WristSizeEntry[];
  selectedId: string | null;
  onSelect: (entry: WristSizeEntry) => void;
  className?: string;
  scrollable?: boolean;
  variant?: WristSizePickerVariant;
}

export function WristSizePickerCards({
  label,
  sizes,
  selectedId,
  onSelect,
  className,
  scrollable = false,
  variant = "onboarding",
}: WristSizePickerCardsProps) {
  if (!sizes.length) return null;

  const isInline = variant === "inline";

  return (
    <div className={cn("w-full", !isInline && "flex flex-col items-center", className)}>
      {label ? (
        <p
          className={cn(
            "mb-2.5 w-full font-medium uppercase tracking-[0.2em] text-muted-foreground",
            isInline ? "text-[9px]" : "text-center text-[10px]",
          )}
        >
          {label}
        </p>
      ) : null}

      <div
        role="radiogroup"
        aria-label={label ?? "Wrist size"}
        className={cn(
          "flex w-full flex-wrap",
          isInline ? "justify-start gap-1.5" : "justify-center gap-2 sm:gap-2.5",
          scrollable && "max-h-[min(50vh,20rem)] overflow-y-auto overscroll-contain",
        )}
      >
        {sizes.map((entry) => {
          const selected = selectedId === entry.id;
          const sizeText = formatWristSizeCm(entry.sizeCm);
          const descriptor = wristSizeDescriptor(entry.label, entry.sizeCm);
          const ariaLabel = descriptor
            ? `${sizeText} centimetres, ${descriptor}`
            : `${sizeText} centimetres`;

          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={ariaLabel}
              onClick={() => onSelect(entry)}
              className={cn(
                "group flex shrink-0 flex-col items-center justify-center text-center",
                "transition-[border-color,background-color,box-shadow,transform] duration-250 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isInline
                  ? "h-10 w-[3.75rem] rounded-lg px-1 py-1.5"
                  : "min-h-[3.5rem] w-[4.5rem] rounded-xl px-2 py-2 sm:min-h-[3.75rem] sm:w-[4.75rem] sm:py-2.5",
                selected
                  ? cn(
                      "border-2 border-primary/70 bg-primary/[0.08]",
                      "shadow-[0_2px_14px_hsl(var(--primary)/0.14),inset_0_1px_0_hsl(var(--primary)/0.12)]",
                    )
                  : cn(
                      "border border-border/50 bg-background/50",
                      "hover:border-primary/35 hover:bg-muted/20 hover:shadow-sm",
                      "active:scale-[0.98]",
                    ),
              )}
            >
              <div className="flex flex-col items-center leading-none">
                <span
                  className={cn(
                    "type-price",
                    isInline ? "text-body" : "text-body-lg sm:text-feature",
                    selected ? "text-foreground" : "text-foreground/80 group-hover:text-foreground",
                  )}
                >
                  {sizeText}
                </span>
                <span
                  className={cn(
                    "type-label mt-1 text-muted-foreground/80",
                    isInline ? "text-[0.6rem]" : "",
                  )}
                >
                  cm
                </span>
              </div>

              {descriptor && !isInline ? (
                <span
                  className={cn(
                    "mt-1.5 max-w-full truncate px-1 text-[9px] leading-none",
                    selected ? "text-foreground/70" : "text-muted-foreground/85",
                  )}
                >
                  {descriptor}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
