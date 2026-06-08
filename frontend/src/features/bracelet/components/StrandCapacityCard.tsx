import type { BraceletStrandSummary } from "@bino-foundry/shared/types";

import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";
import { formatCapacityCm } from "../wrist-fit";

interface StrandCapacityCardProps {
  strand: BraceletStrandSummary;
  showStrandLabel: boolean;
  compact?: boolean;
  hideHeader?: boolean;
  className?: string;
  /** Ring expanded beyond wrist baseline to prevent bead overlap (display only). */
  visuallyExpanded?: boolean;
  /** Resolved ring exceeds canvas — zoom out or reduce pieces. */
  visualOverCanvas?: boolean;
}

function CapacityMetric({
  label,
  value,
  emphasize = false,
  warning = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "type-price mt-1 text-small sm:text-body",
          warning ? "text-destructive" : emphasize ? "text-foreground" : "text-foreground/90",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function StrandCapacityCard({
  strand,
  showStrandLabel,
  compact = false,
  hideHeader = false,
  className,
  visuallyExpanded = false,
  visualOverCanvas = false,
}: StrandCapacityCardProps) {
  const targetCm = formatCapacityCm(strand.wristCircumferenceMm);
  const usedCm = formatCapacityCm(strand.usedMm);
  const remainingCm = strand.isOverCapacity
    ? formatCapacityCm(0)
    : formatCapacityCm(Math.max(0, strand.remainingMm));
  const fillPercent = Math.min(100, Math.max(0, strand.capacityPercent));
  const displayPercent = strand.isOverCapacity ? strand.capacityPercent : fillPercent;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/70",
        strand.isOverCapacity ? "border-destructive/35" : "border-border/60",
        className,
      )}
    >
      <div className={cn("px-3.5 py-3.5", compact && "px-2 py-2")}>
        {!hideHeader ? (
          <div className="flex items-baseline justify-between gap-2">
            <p className="type-small font-medium text-foreground">
              {showStrandLabel ? strand.label : BRACELET_COPY.summaryCapacity}
            </p>
            {strand.placedCount > 0 ? (
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {strand.placedCount} {BRACELET_COPY.piecesOnStrand}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={cn("grid grid-cols-3 gap-2", !hideHeader && "mt-3", compact && "gap-1.5")}>
          <CapacityMetric label={BRACELET_COPY.summaryTarget} value={targetCm} />
          <CapacityMetric label={BRACELET_COPY.summaryUsed} value={usedCm} emphasize />
          <CapacityMetric
            label={BRACELET_COPY.summaryRemaining}
            value={remainingCm}
            warning={strand.isOverCapacity}
          />
        </div>

        <div className="mt-3.5">
          <div className="h-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 ease-out",
                strand.isOverCapacity
                  ? "bg-destructive/65"
                  : fillPercent >= 100
                    ? "bg-primary/50"
                    : "bg-primary/35",
              )}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p
            className={cn(
              "mt-1.5 text-[10px] tabular-nums",
              strand.isOverCapacity ? "text-destructive/90" : "text-muted-foreground",
            )}
          >
            {strand.isOverCapacity
              ? `${BRACELET_COPY.summaryOverCapacity} · ${BRACELET_COPY.summaryOverBy(formatCapacityCm(strand.overCapacityMm))}`
              : BRACELET_COPY.summaryFilledPct(displayPercent)}
          </p>
        </div>

        {strand.isOverCapacity ? (
          <p className="mt-2.5 text-[11px] leading-snug text-destructive/90">
            {BRACELET_COPY.summaryOverCapacityHint(formatCapacityCm(strand.overCapacityMm))}
          </p>
        ) : visualOverCanvas ? (
          <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
            {BRACELET_COPY.visualOverCanvasHint}
          </p>
        ) : fillPercent >= 100 ? (
          <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
            {BRACELET_COPY.capacityFull}
          </p>
        ) : visuallyExpanded ? (
          <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
            {BRACELET_COPY.visualExpandedHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
