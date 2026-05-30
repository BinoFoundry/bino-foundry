import { ChevronDown, ChevronUp, Gem, Sparkles } from "lucide-react";
import { useState } from "react";

import type { BraceletBuilderSummary } from "@bino-foundry/shared/types";

import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";

interface BraceletSummaryPanelProps {
  summary: BraceletBuilderSummary;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

function MaterialGroup({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Gem;
  rows: { name: string; quantity: number; subtotal: number }[];
}) {
  if (!rows.length) return null;
  const sub = rows.reduce((s, r) => s + r.subtotal, 0);
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary/70" />
          <span className="font-display text-xs font-semibold tracking-wide text-foreground">{title}</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">${sub.toFixed(2)}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={`${title}-${row.name}`} className="flex justify-between gap-2 text-xs">
            <span className="truncate text-foreground/90">
              {row.name}
              {row.quantity > 1 ? <span className="text-muted-foreground"> × {row.quantity}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">${row.subtotal.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BraceletSummaryPanel({
  summary,
  className,
  collapsible = false,
  defaultOpen = true,
}: BraceletSummaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { pricing } = summary;
  const remaining = pricing.capacityCount - pricing.placedCount;
  const fillPct = pricing.capacityCount
    ? Math.round((pricing.placedCount / pricing.capacityCount) * 100)
    : 0;

  const body = (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{summary.configSummary}</p>
        {summary.beadSizeLabel ? (
          <p className="mt-2 text-[11px] text-foreground/80">
            Selected bead size: <span className="font-medium">{summary.beadSizeLabel}</span>
          </p>
        ) : null}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/80 transition-all duration-300"
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {pricing.placedCount} of {pricing.capacityCount} spaces filled
        </p>
      </div>

      <div className="grid gap-2">
        {summary.strands.map((s) => (
          <div
            key={s.index}
            className="rounded-lg border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm"
          >
            <p className="font-display text-sm font-medium text-foreground">{s.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.wristSizeCm} cm wrist · {s.placedCount} of {s.capacity} beads
            </p>
          </div>
        ))}
      </div>

      {pricing.placedCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          {BRACELET_COPY.summaryEmpty}
        </p>
      ) : (
        <div className="space-y-2">
          <MaterialGroup title="Crystals" icon={Gem} rows={summary.crystals} />
          <MaterialGroup title="Charms" icon={Sparkles} rows={summary.charms} />
          <MaterialGroup title="Spacers" icon={Gem} rows={summary.spacers} />
          {summary.other.length > 0 ? (
            <MaterialGroup title="Other accents" icon={Sparkles} rows={summary.other} />
          ) : null}
          {remaining > 0 ? (
            <p className="text-center text-[11px] text-muted-foreground">{BRACELET_COPY.summaryRemaining(remaining)}</p>
          ) : null}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-sm text-foreground">{BRACELET_COPY.estimatedTotal}</span>
          <span className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            ${pricing.total.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{BRACELET_COPY.priceNote}</p>
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <aside
        className={cn(
          "flex h-full w-full flex-col border-border bg-gradient-to-b from-card/80 to-background lg:w-80 lg:border-l",
          className,
        )}
      >
        <div className="border-b border-border/80 px-4 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">{BRACELET_COPY.summaryTitle}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{body}</div>
      </aside>
    );
  }

  return (
    <div className={cn("border-t border-border bg-card/60", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <span className="font-display text-sm font-semibold text-foreground">{BRACELET_COPY.summaryTitle}</span>
          <span className="ml-2 font-display text-sm tabular-nums text-primary">${pricing.total.toFixed(2)}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? <div className="max-h-[45vh] overflow-y-auto px-4 pb-4">{body}</div> : null}
    </div>
  );
}
