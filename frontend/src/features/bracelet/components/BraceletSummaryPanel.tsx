import { ChevronDown, ChevronUp, Gem, Save, Sparkles } from "lucide-react";
import { useState } from "react";

import type { BraceletBuilderSummary } from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import { activeWristSizes } from "../wrist-sizes";
import { WristSizePickerCards } from "./WristSizePickerCards";
import { BraceletBuilderActions, type BraceletBuilderActionsProps } from "./BraceletBuilderActions";
import { StrandCapacityCard } from "./StrandCapacityCard";

export interface StrandVisualLayoutHint {
  visuallyExpanded?: boolean;
  visualOverCanvas?: boolean;
}

interface BraceletSummaryPanelProps {
  summary: BraceletBuilderSummary;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  builderActions?: BraceletBuilderActionsProps;
  wristSizes?: WristSizeEntry[];
  wristSizeIdA?: string | null;
  wristSizeIdB?: string | null;
  onSelectWristA?: (entry: WristSizeEntry) => void;
  onSelectWristB?: (entry: WristSizeEntry) => void;
  wristSizeConfirmed?: boolean;
  visualLayoutA?: StrandVisualLayoutHint;
  visualLayoutB?: StrandVisualLayoutHint;
  onSave?: () => void;
  saving?: boolean;
  saveStatus?: string;
  saveDisabled?: boolean;
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

function WristTargetPicker({
  label,
  sizes,
  selectedId,
  onSelect,
}: {
  label: string;
  sizes: WristSizeEntry[];
  selectedId: string | null | undefined;
  onSelect?: (entry: WristSizeEntry) => void;
}) {
  if (!sizes.length || !onSelect) return null;
  return (
    <WristSizePickerCards
      label={label}
      sizes={sizes}
      selectedId={selectedId ?? null}
      onSelect={onSelect}
      variant="inline"
      scrollable={sizes.length > 16}
    />
  );
}

export function BraceletSummaryPanel({
  summary,
  className,
  collapsible = false,
  defaultOpen = true,
  builderActions,
  wristSizes = [],
  wristSizeIdA,
  wristSizeIdB,
  onSelectWristA,
  onSelectWristB,
  wristSizeConfirmed = false,
  visualLayoutA,
  visualLayoutB,
  onSave,
  saving = false,
  saveStatus = "",
  saveDisabled = false,
}: BraceletSummaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { pricing } = summary;
  const wristOptions = activeWristSizes(wristSizes);

  const body = (
    <div className="space-y-4">
      {builderActions ? <BraceletBuilderActions {...builderActions} /> : null}

      {wristSizeConfirmed && wristOptions.length > 0 && onSelectWristA ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
          <p className="text-[10px] leading-snug text-muted-foreground">{BRACELET_COPY.wristChangeHint}</p>
          <WristTargetPicker
            label={summary.twinning ? BRACELET_COPY.wristTwinA : BRACELET_COPY.wristLabel}
            sizes={wristOptions}
            selectedId={wristSizeIdA}
            onSelect={onSelectWristA}
          />
          {summary.twinning && onSelectWristB ? (
            <WristTargetPicker
              label={BRACELET_COPY.wristTwinB}
              sizes={wristOptions}
              selectedId={wristSizeIdB}
              onSelect={onSelectWristB}
            />
          ) : null}
        </div>
      ) : null}

      <div className={summary.twinning ? "grid gap-3" : undefined}>
        {summary.strands.map((strand) => {
          const visual =
            strand.index === 0
              ? visualLayoutA
              : strand.index === 1
                ? visualLayoutB
                : undefined;
          return (
            <StrandCapacityCard
              key={strand.index}
              strand={strand}
              showStrandLabel={summary.twinning}
              visuallyExpanded={visual?.visuallyExpanded}
              visualOverCanvas={visual?.visualOverCanvas}
            />
          );
        })}
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

      {onSave ? (
        <div className="space-y-2">
          {saveStatus ? (
            <p className="text-center text-[11px] leading-snug text-foreground/80">{saveStatus}</p>
          ) : null}
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={saveDisabled}
            onClick={onSave}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? BRACELET_COPY.saving : BRACELET_COPY.saveConfig}
          </Button>
        </div>
      ) : null}
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
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          data-scroll-isolate="true"
          onWheel={(e) => e.stopPropagation()}
        >
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
