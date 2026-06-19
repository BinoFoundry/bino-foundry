import { memo, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tintPreviewStyle } from "@/features/admin/lib/adminHex";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

import { formatCurrency, formatCurrencySurcharge } from "@bino-foundry/shared/currency";

import { formatBuilderOptionDescription, SUNGLASSES_COPY, SUNGLASSES_PRICE } from "../../copy";

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
        "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "state-selected-subtle ring-1 ring-selection/25"
          : "border-border state-hoverable",
      )}
    >
      <span
        className="h-12 w-full rounded-lg border border-black/10 shadow-inner"
        style={tintPreviewStyle(tint)}
        aria-hidden
      />
      <span className="text-center text-xs font-medium text-foreground">{tint.name}</span>
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
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
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
}: LensStepPanelProps) {
  const polarizedSurcharge = polarizedOption?.priceSurcharge ?? 0;
  const defaultTab = useMemo(
    () => (gradientTints.length && !classicTints.length ? "gradient" : "classic"),
    [classicTints.length, gradientTints.length],
  );
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-h3">{SUNGLASSES_COPY.lensStepTitle}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{SUNGLASSES_COPY.lensStepIntro}</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-3">
        <p className="type-label text-muted-foreground">Lens type</p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {polarized ? "Polarised lenses" : "Standard lenses (non-polarised)"}
        </p>
        {polarizedOption && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="relative z-10 grid w-full grid-cols-2">
          <TabsTrigger value="classic">Classic</TabsTrigger>
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
        </TabsList>
        <TabsContent value="classic" className="mt-4">
          <TintGrid
            tints={classicTints}
            activeTintId={activeTintId}
            onSelectTint={onSelectTint}
            groupLabel="Classic lens tints"
            currencyCode={currencyCode}
          />
        </TabsContent>
        <TabsContent value="gradient" className="mt-4">
          <TintGrid
            tints={gradientTints}
            activeTintId={activeTintId}
            onSelectTint={onSelectTint}
            groupLabel="Gradient lens tints"
            currencyCode={currencyCode}
          />
        </TabsContent>
      </Tabs>

      {lensDisclaimer && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
      )}
    </div>
  );
}
