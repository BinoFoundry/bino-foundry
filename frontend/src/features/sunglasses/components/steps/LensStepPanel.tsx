import { ChevronRight } from "lucide-react";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ScrollMoreHint } from "@/components/common";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContainedScrollWheel } from "@/hooks/use-contained-scroll-wheel";
import { useScrollOverflowHint } from "@/hooks/use-scroll-overflow-hint";
import { tintPreviewStyle } from "@/features/admin/lib/adminHex";
import { cn } from "@/lib/utils";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

import { formatCurrencySurcharge } from "@bino-foundry/shared/currency";

import { formatBuilderOptionDescription, SUNGLASSES_COPY, SUNGLASSES_PRICE } from "../../copy";

type TintTab = "classic" | "gradient";

const LENS_OPTION_CARD =
  "rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2 sm:px-3 sm:py-2.5";

const LENS_TAB_LIST_CLASS =
  "grid h-9 w-full grid-cols-2 gap-1 rounded-lg border border-border/50 bg-muted/40 p-0.5 sm:h-10";

const LENS_TAB_TRIGGER_CLASS = cn(
  "h-full min-h-[2.25rem] rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors sm:min-h-[2.5rem] sm:text-sm",
  "hover:bg-[#D9BBB0]/80 hover:text-[#404225]",
  "data-[state=active]:bg-[#D9BBB0] data-[state=active]:text-[#404225] data-[state=active]:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
);

const TINT_GRID_CLASS =
  "grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

interface LensStepPanelProps {
  classicTints: LensTintEntry[];
  gradientTints: LensTintEntry[];
  polarizedOption: BuilderOptionEntry | undefined;
  polarized: boolean;
  activeTintId: string | null;
  lensDisclaimer: string;
  currencyCode: string;
  onPolarizedChange: (value: boolean) => void;
  onSelectTint: (tintId: string) => void;
  onContinue?: () => void;
  saveStatus?: ReactNode;
}

const TintSwatch = memo(function TintSwatch({
  tint,
  active,
  onSelect,
  currencyCode,
}: {
  tint: LensTintEntry;
  active: boolean;
  onSelect: (id: string) => void;
  currencyCode: string;
}) {
  const label = `${tint.name}, ${tint.code}${
    tint.priceSurcharge > 0 ? `, plus ${formatCurrency(tint.priceSurcharge, currencyCode)}` : ""
  }`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={() => onSelect(tint.id)}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors sm:gap-2 sm:p-2.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "state-selected-subtle ring-1 ring-selection/25"
          : "border-border state-hoverable",
      )}
    >
      <span
        className="aspect-[5/3] w-full min-w-0 rounded-md border border-black/10 shadow-inner sm:rounded-lg"
        style={tintPreviewStyle(tint)}
        aria-hidden
      />
      <span className="w-full truncate text-center text-[11px] font-medium text-foreground sm:text-xs">
        {tint.name}
      </span>
      <span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">{tint.code}</span>
      {tint.priceSurcharge > 0 && (
        <span className={cn(SUNGLASSES_PRICE.surcharge, "text-[10px] sm:text-xs")}>
          {formatCurrencySurcharge(tint.priceSurcharge, currencyCode)}
        </span>
      )}
    </button>
  );
});

function TintGrid({
  tints,
  activeTintId,
  onSelectTint,
  groupLabel,
  currencyCode,
}: {
  tints: LensTintEntry[];
  activeTintId: string | null;
  onSelectTint: (id: string) => void;
  groupLabel: string;
  currencyCode: string;
}) {
  if (!tints.length) {
    return <p className="text-sm text-muted-foreground">No tints in this category yet.</p>;
  }

  return (
    <div role="radiogroup" aria-label={groupLabel} className={TINT_GRID_CLASS}>
      {tints.map((tint) => (
        <TintSwatch
          key={tint.id}
          tint={tint}
          active={activeTintId === tint.id}
          onSelect={onSelectTint}
          currencyCode={currencyCode}
        />
      ))}
    </div>
  );
}

function resolveInitialTab(
  activeTintId: string | null,
  classicTints: LensTintEntry[],
  gradientTints: LensTintEntry[],
): TintTab {
  if (activeTintId && gradientTints.some((t) => t.id === activeTintId)) return "gradient";
  if (activeTintId && classicTints.some((t) => t.id === activeTintId)) return "classic";
  if (gradientTints.length && !classicTints.length) return "gradient";
  return "classic";
}

function LensTypeCard({ polarized }: { polarized: boolean }) {
  return (
    <div className={LENS_OPTION_CARD}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Lens type</p>
      <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">
        {polarized ? "Polarised lenses" : "Standard (non-polarised)"}
      </p>
    </div>
  );
}

function PolarisedUpgradeCard({
  polarizedOption,
  polarized,
  polarizedSurcharge,
  currencyCode,
  onPolarizedChange,
}: {
  polarizedOption: BuilderOptionEntry;
  polarized: boolean;
  polarizedSurcharge: number;
  currencyCode: string;
  onPolarizedChange: (value: boolean) => void;
}) {
  return (
    <div className={cn(LENS_OPTION_CARD, "flex items-center justify-between gap-2 sm:gap-3")}>
      <div className="min-w-0 flex-1">
        <Label htmlFor="polarized-toggle" className="text-sm font-medium leading-snug text-foreground">
          Upgrade to {polarizedOption.label}
        </Label>
        {(polarizedSurcharge > 0 || polarizedOption.description) ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {polarizedSurcharge > 0 ? (
              <span className={SUNGLASSES_PRICE.surcharge}>
                {formatCurrencySurcharge(polarizedSurcharge, currencyCode)}
              </span>
            ) : null}
            {polarizedSurcharge > 0 && polarizedOption.description ? " · " : null}
            {polarizedOption.description
              ? formatBuilderOptionDescription(polarizedOption.description)
              : null}
          </p>
        ) : null}
      </div>
      <Switch
        id="polarized-toggle"
        className="shrink-0"
        checked={polarized}
        onCheckedChange={onPolarizedChange}
      />
    </div>
  );
}

export function LensStepPanel({
  classicTints,
  gradientTints,
  polarizedOption,
  polarized,
  activeTintId,
  lensDisclaimer,
  currencyCode,
  onPolarizedChange,
  onSelectTint,
  onContinue,
  saveStatus,
}: LensStepPanelProps) {
  const polarizedSurcharge = polarizedOption?.priceSurcharge ?? 0;
  const [activeTab, setActiveTab] = useState<TintTab>(() =>
    resolveInitialTab(activeTintId, classicTints, gradientTints),
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<TintTab, number>>({ classic: 0, gradient: 0 });

  const hasMoreBelow = useScrollOverflowHint(scrollRef, [activeTab, classicTints.length, gradientTints.length]);
  useContainedScrollWheel(scrollRef, panelRef, true);

  const tabCounts = useMemo(
    () => ({ classic: classicTints.length, gradient: gradientTints.length }),
    [classicTints.length, gradientTints.length],
  );

  const activeTints = activeTab === "classic" ? classicTints : gradientTints;
  const activeGroupLabel =
    activeTab === "classic" ? "Classic lens tints" : "Gradient lens tints";

  const handleTabChange = useCallback(
    (next: string) => {
      const current = activeTab;
      if (scrollRef.current) {
        scrollPositions.current[current] = scrollRef.current.scrollTop;
      }
      setActiveTab(next as TintTab);
    },
    [activeTab],
  );

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollPositions.current[activeTab];
    }
  }, [activeTab]);

  const handlePanelScroll = useCallback(() => {
    if (scrollRef.current) {
      scrollPositions.current[activeTab] = scrollRef.current.scrollTop;
    }
  }, [activeTab]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-2.5">
      <div className="shrink-0 space-y-2">
        <div>
          <h3 className="type-h3 text-base leading-tight sm:text-lg">{SUNGLASSES_COPY.lensStepTitle}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground sm:line-clamp-1">
            {SUNGLASSES_COPY.lensStepIntro}
          </p>
        </div>

        {polarizedOption ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-2.5">
            <LensTypeCard polarized={polarized} />
            <PolarisedUpgradeCard
              polarizedOption={polarizedOption}
              polarized={polarized}
              polarizedSurcharge={polarizedSurcharge}
              currencyCode={currencyCode}
              onPolarizedChange={onPolarizedChange}
            />
          </div>
        ) : (
          <LensTypeCard polarized={polarized} />
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <p className="type-label shrink-0 text-sm text-foreground">Choose lens tint</p>

        <div
          ref={panelRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/30"
          data-lens-tint-panel="true"
        >
          <div
            ref={scrollRef}
            className="customiser-options-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
            onScroll={handlePanelScroll}
          >
            <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-2.5 pb-1.5 pt-2 backdrop-blur-sm sm:px-3 sm:pb-2 sm:pt-2.5">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className={LENS_TAB_LIST_CLASS} aria-label="Lens tint categories">
                  <TabsTrigger
                    id="lens-tint-tab-classic"
                    value="classic"
                    className={LENS_TAB_TRIGGER_CLASS}
                    disabled={!tabCounts.classic}
                  >
                    Classic
                    {tabCounts.classic > 0 ? (
                      <span className="ml-1 text-[10px] opacity-80 sm:ml-1.5 sm:text-xs">
                        ({tabCounts.classic})
                      </span>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger
                    id="lens-tint-tab-gradient"
                    value="gradient"
                    className={LENS_TAB_TRIGGER_CLASS}
                    disabled={!tabCounts.gradient}
                  >
                    Gradient
                    {tabCounts.gradient > 0 ? (
                      <span className="ml-1 text-[10px] opacity-80 sm:ml-1.5 sm:text-xs">
                        ({tabCounts.gradient})
                      </span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div
              className="px-2.5 py-2.5 sm:px-3 sm:py-3"
              role="tabpanel"
              id={`lens-tint-panel-${activeTab}`}
              aria-labelledby={`lens-tint-tab-${activeTab}`}
            >
              <TintGrid
                tints={activeTints}
                activeTintId={activeTintId}
                onSelectTint={onSelectTint}
                groupLabel={activeGroupLabel}
                currencyCode={currencyCode}
              />
            </div>

            {lensDisclaimer ? (
              <p className="px-2.5 pb-1.5 text-[10px] leading-snug text-muted-foreground sm:px-3">
                * {lensDisclaimer}
              </p>
            ) : null}

            {onContinue ? (
              <div className="space-y-2 border-t border-border/60 px-2.5 pb-3 pt-3 sm:px-3 sm:pb-4 sm:pt-4">
                {saveStatus}
                <Button type="button" className="w-full" size="lg" onClick={onContinue}>
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <ScrollMoreHint visible={hasMoreBelow} label="Scroll for more colours" />
        </div>
      </div>
    </div>
  );
}
