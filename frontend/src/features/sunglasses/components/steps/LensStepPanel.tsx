import { ChevronRight } from "lucide-react";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

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

import { formatCurrency, formatCurrencySurcharge } from "@bino-foundry/shared/currency";

import { formatBuilderOptionDescription, SUNGLASSES_COPY, SUNGLASSES_PRICE } from "../../copy";

type TintTab = "classic" | "gradient";

const LENS_TAB_LIST_CLASS =
  "grid h-11 w-full grid-cols-2 gap-1 rounded-lg border border-border/50 bg-muted/40 p-1";

const LENS_TAB_TRIGGER_CLASS = cn(
  "h-full min-h-[2.75rem] rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors",
  "hover:bg-[#D9BBB0]/80 hover:text-[#404225]",
  "data-[state=active]:bg-[#D9BBB0] data-[state=active]:text-[#404225] data-[state=active]:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
);

const TINT_GRID_CLASS =
  "grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

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
        "flex min-w-0 flex-col items-center gap-2 rounded-xl border p-2.5 transition-colors sm:p-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "state-selected-subtle ring-1 ring-selection/25"
          : "border-border state-hoverable",
      )}
    >
      <span
        className="aspect-[5/3] w-full min-w-0 rounded-lg border border-black/10 shadow-inner"
        style={tintPreviewStyle(tint)}
        aria-hidden
      />
      <span className="w-full truncate text-center text-xs font-medium text-foreground">{tint.name}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{tint.code}</span>
      {tint.priceSurcharge > 0 && (
        <span className={SUNGLASSES_PRICE.surcharge}>
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
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="shrink-0 space-y-5">
        <div>
          <h3 className="type-h3">{SUNGLASSES_COPY.lensStepTitle}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {SUNGLASSES_COPY.lensStepIntro}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="type-label text-muted-foreground">Lens type</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {polarized ? "Polarised lenses" : "Standard lenses (non-polarised)"}
          </p>
          {polarizedOption && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <div className="min-w-0">
                <Label htmlFor="polarized-toggle" className="font-medium text-foreground">
                  Upgrade to {polarizedOption.label}
                </Label>
                {(polarizedSurcharge > 0 || polarizedOption.description) && (
                  <p className="text-xs text-muted-foreground sm:text-sm">
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
                )}
              </div>
              <Switch id="polarized-toggle" checked={polarized} onCheckedChange={onPolarizedChange} />
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <p className="type-label shrink-0 text-foreground">Choose lens tint</p>

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
            <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-3 pb-2 pt-3 backdrop-blur-sm">
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
                      <span className="ml-1.5 text-xs opacity-80">({tabCounts.classic})</span>
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
                      <span className="ml-1.5 text-xs opacity-80">({tabCounts.gradient})</span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div
              className="px-3 py-4"
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
              <p className="px-3 pb-2 text-[10px] leading-relaxed text-muted-foreground">
                * {lensDisclaimer}
              </p>
            ) : null}

            {onContinue ? (
              <div className="border-t border-border/60 px-3 pb-4 pt-5">
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
