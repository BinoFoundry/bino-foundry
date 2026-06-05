import { ChevronDown, ChevronUp, Gem, Sparkles } from "lucide-react";
import { useState } from "react";

import type {
  BraceletBuilderSummary,
  BraceletStrandSummary,
  BraceletWristFitEstimate,
} from "@bino-foundry/shared/types";

import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";
import { formatWristFitRange } from "../wrist-fit";
import { BraceletBuilderActions, type BraceletBuilderActionsProps } from "./BraceletBuilderActions";

interface BraceletSummaryPanelProps {
  summary: BraceletBuilderSummary;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  builderActions?: BraceletBuilderActionsProps;
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

function StrandFitCard({
  strand,
  fit,
  showStrandLabel,
}: {
  strand: BraceletStrandSummary;
  fit: BraceletWristFitEstimate;
  showStrandLabel: boolean;
}) {
  const fillPct = strand.wristCircumferenceMm
    ? Math.round((strand.usedMm / strand.wristCircumferenceMm) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-4">
      {showStrandLabel ? (
        <p className="font-display text-sm font-semibold text-foreground">{strand.label}</p>
      ) : (
        <p className="font-display text-sm font-semibold text-foreground">{BRACELET_COPY.summaryWristFit}</p>
      )}
      <p className={`text-sm text-foreground/90 ${showStrandLabel ? "mt-1" : "mt-1"}`}>
        {formatWristFitRange(fit)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">{BRACELET_COPY.summaryLength}</dt>
          <dd className="font-medium tabular-nums text-foreground">{fit.lengthMm} mm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{BRACELET_COPY.summaryBeadCount}</dt>
          <dd className="font-medium tabular-nums text-foreground">{fit.beadCount}</dd>
        </div>
      </dl>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/80 transition-all duration-300"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {strand.usedMm} mm on strand
        {strand.remainingMm > 0
          ? ` · ${Math.round(strand.remainingMm)} mm available`
          : fit.beadCount > 0
            ? " · strand complete"
            : ""}
      </p>
    </div>
  );
}

export function BraceletSummaryPanel({
  summary,
  className,
  collapsible = false,
  defaultOpen = true,
  builderActions,
}: BraceletSummaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { pricing } = summary;

  const strandFitCards = summary.strands.map((strand, i) => ({
    strand,
    fit: i === 0 ? summary.wristFitA : summary.wristFitB ?? summary.wristFitA,
  }));

  const body = (
    <div className="space-y-4">
      {builderActions ? (
        <BraceletBuilderActions {...builderActions} />
      ) : null}

      <div className={summary.twinning ? "grid gap-3" : undefined}>
        {strandFitCards.map(({ strand, fit }) => (
          <StrandFitCard
            key={strand.index}
            strand={strand}
            fit={fit}
            showStrandLabel={summary.twinning}
          />
        ))}
      </div>

      {pricing.placedCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          {BRACELET_COPY.summaryEmpty}
        </p>
      ) : (
        <div className="space-y-2">
          {summary.materialSections?.length
            ? summary.materialSections.map((section) => (
                <MaterialGroup
                  key={section.slug}
                  title={section.title}
                  icon={section.slug === "charm" ? Sparkles : Gem}
                  rows={section.rows}
                />
              ))
            : (
              <>
                <MaterialGroup title="Crystals" icon={Gem} rows={summary.crystals} />
                <MaterialGroup title="Charms" icon={Sparkles} rows={summary.charms} />
                <MaterialGroup title="Spacers" icon={Gem} rows={summary.spacers} />
              </>
            )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-sm text-foreground">{BRACELET_COPY.estimatedTotal}</span>
          <span className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            ${pricing.total.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          {BRACELET_COPY.priceNote(pricing.currencyCode)}
        </p>
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
        <div className="flex-1 overflow-y-auto px-4 py-4" data-scroll-isolate="true" onWheel={(e) => e.stopPropagation()}>
          {body}
        </div>
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
      {open ? (
        <div
          className="max-h-[45vh] overflow-y-auto px-4 pb-4"
          data-scroll-isolate="true"
          onWheel={(e) => e.stopPropagation()}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
}
