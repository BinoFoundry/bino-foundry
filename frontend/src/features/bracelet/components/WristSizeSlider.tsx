import { useMemo } from "react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { activeWristSizes } from "../wrist-sizes";
import { formatWristSizeCm } from "../wrist-size-display";

interface WristSizeSliderProps {
  sizes: WristSizeEntry[];
  selectedId: string | null;
  onSelect: (entry: WristSizeEntry) => void;
  label?: string;
  className?: string;
  /** Tighter layout for the builder sidebar (Quiet Luxury). */
  compact?: boolean;
}

/** Discrete wrist-size control backed by catalogue entries (no hardcoded sizes). */
export function WristSizeSlider({
  sizes,
  selectedId,
  onSelect,
  label,
  className,
  compact = false,
}: WristSizeSliderProps) {
  const options = useMemo(() => activeWristSizes(sizes), [sizes]);

  const selectedIndex = Math.max(
    0,
    options.findIndex((entry) => entry.id === selectedId),
  );
  const current = options[selectedIndex];

  if (!options.length) {
    return <p className="text-[11px] text-muted-foreground">No sizes available</p>;
  }

  const maxIndex = Math.max(0, options.length - 1);

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-2", className)}>
      {label ? (
        <p
          className={cn(
            "font-medium uppercase tracking-[0.12em] text-muted-foreground",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          {label}
        </p>
      ) : null}
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "tabular-nums text-foreground",
            compact ? "text-sm font-medium leading-none" : "type-price text-lg",
          )}
        >
          {current ? `${formatWristSizeCm(current.sizeCm)} cm` : "—"}
        </span>
        {current?.label && current.label !== formatWristSizeCm(current.sizeCm) ? (
          <span className={cn("truncate text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
            {current.label}
          </span>
        ) : null}
      </div>
      <Slider
        min={0}
        max={maxIndex}
        step={1}
        value={[selectedIndex]}
        disabled={options.length <= 1}
        aria-label={label ?? "Wrist size"}
        className={cn(
          compact
            ? "py-0 [&>span:first-child]:h-1 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border [&_[role=slider]]:shadow-none"
            : "py-1 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4",
          "[&_[role=slider]]:border-[hsl(var(--brand-soft-gold))] [&_.bg-primary]:bg-[hsl(var(--brand-soft-gold))]/70 [&_[role=slider]]:bg-background",
        )}
        onValueChange={([index]) => {
          const entry = options[index ?? 0];
          if (entry) onSelect(entry);
        }}
      />
      <div
        className={cn(
          "flex justify-between tabular-nums text-muted-foreground",
          compact ? "text-[8px]" : "text-[9px]",
        )}
      >
        <span>{formatWristSizeCm(options[0]!.sizeCm)}</span>
        <span>{formatWristSizeCm(options[maxIndex]!.sizeCm)}</span>
      </div>
    </div>
  );
}
