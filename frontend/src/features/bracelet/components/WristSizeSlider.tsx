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
}

/** Discrete wrist-size control backed by catalogue entries (no hardcoded sizes). */
export function WristSizeSlider({
  sizes,
  selectedId,
  onSelect,
  label,
  className,
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
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-[10px] font-medium text-muted-foreground">{label}</p> : null}
      <div className="flex items-baseline justify-between gap-2">
        <span className="type-price text-lg text-foreground">
          {current ? formatWristSizeCm(current.sizeCm) : "—"}
        </span>
        {current?.label && current.label !== formatWristSizeCm(current.sizeCm) ? (
          <span className="truncate text-[10px] text-muted-foreground">{current.label}</span>
        ) : null}
      </div>
      <Slider
        min={0}
        max={maxIndex}
        step={1}
        value={[selectedIndex]}
        disabled={options.length <= 1}
        aria-label={label ?? "Wrist size"}
        className="py-1 [&_.bg-primary]:bg-selection/55 [&_[role=slider]]:border-selection-border [&_[role=slider]]:bg-background"
        onValueChange={([index]) => {
          const entry = options[index ?? 0];
          if (entry) onSelect(entry);
        }}
      />
      <div className="flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>{formatWristSizeCm(options[0]!.sizeCm)}</span>
        <span>{formatWristSizeCm(options[maxIndex]!.sizeCm)}</span>
      </div>
    </div>
  );
}
