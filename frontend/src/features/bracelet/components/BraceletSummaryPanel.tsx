import { ChevronDown, ChevronUp, Save, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { BraceletBuilderSummary } from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import { BUILDER_COPY } from "@/layouts/builder-copy";
import { cn } from "@/lib/utils";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import { formatCapacityCm } from "../wrist-fit";
import { BraceletBuilderActions, type BraceletBuilderActionsProps } from "./BraceletBuilderActions";
import { SelectedBeadsList, type SelectedBeadRow } from "./SelectedBeadsList";
import { StrandCapacityCard } from "./StrandCapacityCard";
import { SummaryInfoCard } from "./SummaryInfoCard";
import { WristSizePickerCards } from "./WristSizePickerCards";

export interface StrandVisualLayoutHint {
  visuallyExpanded?: boolean;
  visualOverCanvas?: boolean;
}

interface BraceletSummaryPanelProps {
  summary: BraceletBuilderSummary;
  mainBeadRows?: SelectedBeadRow[];
  matchingPairBeadRows?: SelectedBeadRow[];
  wristSizeCm: number;
  wristSizeCmB?: number;
  wristSizes?: WristSizeEntry[];
  wristSizeIdA?: string | null;
  wristSizeIdB?: string | null;
  onSelectWristA?: (entry: WristSizeEntry) => void;
  onSelectWristB?: (entry: WristSizeEntry) => void;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  builderActions?: Omit<BraceletBuilderActionsProps, "libraryOpen" | "onToggleLibrary">;
  visualLayoutA?: StrandVisualLayoutHint;
  visualLayoutB?: StrandVisualLayoutHint;
  onSave?: () => void;
  onAddToCart?: () => void;
  saving?: boolean;
  saveStatus?: string;
  saveDisabled?: boolean;
}

function CostLine({
  label,
  amount,
}: {
  label: string;
  amount: number;
}) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="truncate text-foreground/90">{label}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">${amount.toFixed(2)}</span>
    </div>
  );
}

export function BraceletSummaryPanel({
  summary,
  mainBeadRows = [],
  matchingPairBeadRows = [],
  wristSizeCm,
  wristSizeCmB,
  wristSizes = [],
  wristSizeIdA,
  wristSizeIdB,
  onSelectWristA,
  onSelectWristB,
  className,
  collapsible = false,
  defaultOpen = true,
  builderActions,
  visualLayoutA,
  visualLayoutB,
  onSave,
  onAddToCart,
  saving = false,
  saveStatus = "",
  saveDisabled = false,
}: BraceletSummaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [changingWrist, setChangingWrist] = useState(false);
  const { pricing } = summary;
  const strandA = summary.strands[0];
  const strandB = summary.strands[1];
  const mainBeadCount = strandA?.placedCount ?? 0;
  const pairBeadCount = strandB?.placedCount ?? 0;

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart();
      return;
    }
    toast.message(BUILDER_COPY.addToCartComingSoon);
  };

  const body = (
    <div className="space-y-3">
      <SummaryInfoCard title={BRACELET_COPY.braceletPreview}>
        <p className="type-body text-sm text-foreground">
          {mainBeadCount === 0
            ? BRACELET_COPY.summaryEmpty
            : `${BRACELET_COPY.beadCountSummary(mainBeadCount)} · ${formatCapacityCm(strandA?.usedMm ?? 0)} placed`}
        </p>
        {summary.twinning && pairBeadCount > 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {BRACELET_COPY.matchingPairTitle}: {BRACELET_COPY.beadCountSummary(pairBeadCount)}
          </p>
        ) : null}
      </SummaryInfoCard>

      <SummaryInfoCard title={BRACELET_COPY.currentWristSize}>
        <div className="flex items-center justify-between gap-2">
          <span className="type-price text-lg text-foreground">
            {summary.twinning && wristSizeCmB != null
              ? `${wristSizeCm} cm · ${wristSizeCmB} cm`
              : `${wristSizeCm} cm`}
          </span>
          {onSelectWristA ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => setChangingWrist((v) => !v)}
            >
              {BRACELET_COPY.changeSize}
            </Button>
          ) : null}
        </div>
        {changingWrist && onSelectWristA ? (
          <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
            <WristSizePickerCards
              label={summary.twinning ? BRACELET_COPY.wristTwinA : BRACELET_COPY.wristLabel}
              sizes={wristSizes}
              selectedId={wristSizeIdA ?? null}
              onSelect={onSelectWristA}
              variant="inline"
              scrollable={wristSizes.length > 8}
            />
            {summary.twinning && onSelectWristB ? (
              <WristSizePickerCards
                label={BRACELET_COPY.wristTwinB}
                sizes={wristSizes}
                selectedId={wristSizeIdB ?? null}
                onSelect={onSelectWristB}
                variant="inline"
                scrollable={wristSizes.length > 8}
              />
            ) : null}
          </div>
        ) : null}
      </SummaryInfoCard>

      <SummaryInfoCard title={BRACELET_COPY.matchingPairTitle}>
        <p className="text-sm font-medium text-foreground">
          {summary.twinning ? BRACELET_COPY.matchingPairEnabled : BRACELET_COPY.matchingPairNotEnabled}
        </p>
        {builderActions ? (
          <div className="mt-2 border-t border-border/50 pt-2">
            <BraceletBuilderActions {...builderActions} />
          </div>
        ) : null}
      </SummaryInfoCard>

      {strandA ? (
        <SummaryInfoCard title={BRACELET_COPY.summaryCapacity}>
          <StrandCapacityCard
            strand={strandA}
            showStrandLabel={false}
            compact
            hideHeader
            visuallyExpanded={visualLayoutA?.visuallyExpanded}
            visualOverCanvas={visualLayoutA?.visualOverCanvas}
            className="border-0 bg-transparent shadow-none"
          />
        </SummaryInfoCard>
      ) : null}

      {summary.twinning && strandB ? (
        <SummaryInfoCard title={`${BRACELET_COPY.matchingPairTitle} · ${BRACELET_COPY.summaryCapacity}`}>
          <StrandCapacityCard
            strand={strandB}
            showStrandLabel={false}
            compact
            hideHeader
            visuallyExpanded={visualLayoutB?.visuallyExpanded}
            visualOverCanvas={visualLayoutB?.visualOverCanvas}
            className="border-0 bg-transparent shadow-none"
          />
        </SummaryInfoCard>
      ) : null}

      <SummaryInfoCard title={BRACELET_COPY.mainBraceletTitle}>
        <SelectedBeadsList rows={mainBeadRows} compact />
      </SummaryInfoCard>

      {summary.twinning ? (
        <SummaryInfoCard title={BRACELET_COPY.matchingPairTitle}>
          <SelectedBeadsList rows={matchingPairBeadRows} compact />
        </SummaryInfoCard>
      ) : null}

      <SummaryInfoCard title={BRACELET_COPY.costBreakdown}>
        {pricing.placedCount === 0 ? (
          <p className="text-[11px] text-muted-foreground">—</p>
        ) : (
          <div className="space-y-1.5">
            {pricing.lineItems.map((item) => (
              <CostLine
                key={item.offerKey}
                label={
                  item.quantity > 1
                    ? `${item.sizeLabel || item.beadName} × ${item.quantity}`
                    : item.sizeLabel || item.beadName
                }
                amount={item.lineTotal}
              />
            ))}
            <div className="border-t border-border/50 pt-1.5">
              <CostLine label={BRACELET_COPY.subtotal} amount={pricing.subtotal} />
            </div>
          </div>
        )}
      </SummaryInfoCard>

      <div className="rounded-xl border border-border/45 bg-card/50 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="type-body text-sm text-foreground">{BRACELET_COPY.estimatedTotal}</span>
          <span className="type-price text-xl text-foreground">${pricing.total.toFixed(2)}</span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          {BRACELET_COPY.priceNote(pricing.currencyCode)}
        </p>
      </div>

      <div className="space-y-1.5 pt-0.5">
        {saveStatus ? (
          <p className="text-center text-[10px] leading-snug text-foreground/80">{saveStatus}</p>
        ) : null}
        {onSave ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            size="default"
            disabled={saveDisabled}
            onClick={onSave}
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            {saving ? BRACELET_COPY.saving : BRACELET_COPY.saveConfig}
          </Button>
        ) : null}
        <Button type="button" className="w-full" size="default" disabled={saveDisabled} onClick={handleAddToCart}>
          <ShoppingBag className="mr-2 h-3.5 w-3.5" />
          {BRACELET_COPY.addToCart}
        </Button>
      </div>
    </div>
  );

  const panelHeader = (
    <div className="shrink-0 border-b border-border/80 px-3 py-2.5">
      <h2 className="type-h3 text-base">{BRACELET_COPY.summaryTitle}</h2>
    </div>
  );

  if (!collapsible) {
    return (
      <aside className={cn("flex h-full w-full flex-col bg-background", className)}>
        {panelHeader}
        <div className="flex-1 overflow-y-auto px-3 py-3">{body}</div>
      </aside>
    );
  }

  return (
    <div className={cn("border-t border-border/50 bg-background/40", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <span className="type-body font-medium text-foreground">{BRACELET_COPY.summaryTitle}</span>
          <span className="type-price ml-2 text-body text-primary">${pricing.total.toFixed(2)}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <div
          className="max-h-[45vh] overflow-y-auto px-3 pb-3"
          data-scroll-isolate="true"
          onWheel={(e) => e.stopPropagation()}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
}
