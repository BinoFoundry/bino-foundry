import { memo, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tintPreviewStyle } from "@/features/admin/lib/adminHex";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

interface LensStepPanelProps {
  classicTints: LensTintEntry[];
  gradientTints: LensTintEntry[];
  polarizedOption: BuilderOptionEntry | undefined;
  polarized: boolean;
  activeTintId: string | null;
  lensDisclaimer: string;
  onPolarizedChange: (value: boolean) => void;
  onSelectTint: (tintId: string) => void;
}

const TintSwatch = memo(function TintSwatch({
  tint,
  active,
  onSelect,
}: {
  tint: LensTintEntry;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const label = `${tint.name}, ${tint.code}${tint.priceSurcharge > 0 ? `, plus ${tint.priceSurcharge} dollars` : ""}`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={() => onSelect(tint.id)}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/40",
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
        <span className="text-[10px] text-muted-foreground">+${tint.priceSurcharge}</span>
      )}
    </button>
  );
});

function TintGrid({
  tints,
  activeTintId,
  onSelectTint,
  groupLabel,
}: {
  tints: LensTintEntry[];
  activeTintId: string | null;
  onSelectTint: (id: string) => void;
  groupLabel: string;
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
        <TintSwatch key={tint.id} tint={tint} active={activeTintId === tint.id} onSelect={onSelectTint} />
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
        <h3 className="type-h3">Lens options</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose standard or polarised lenses, then pick a tint. Colour is applied to the lens only — the frame stays
          unchanged in real time.
        </p>
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
              <p className="text-xs text-muted-foreground">
                {polarized ? "Enabled" : "Off — standard lenses"}
                {polarizedSurcharge > 0 ? ` · +$${polarizedSurcharge}` : ""}
                {polarizedOption.description ? ` · ${polarizedOption.description}` : ""}
              </p>
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
          />
        </TabsContent>
        <TabsContent value="gradient" className="mt-4">
          <TintGrid
            tints={gradientTints}
            activeTintId={activeTintId}
            onSelectTint={onSelectTint}
            groupLabel="Gradient lens tints"
          />
        </TabsContent>
      </Tabs>

      {lensDisclaimer && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
      )}
    </div>
  );
}
