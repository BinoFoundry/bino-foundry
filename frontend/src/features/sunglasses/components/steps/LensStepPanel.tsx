import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function TintSwatch({
  tint,
  active,
  onSelect,
}: {
  tint: LensTintEntry;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tint.id)}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all",
        active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/40",
      )}
    >
      <span
        className="h-12 w-full rounded-lg border border-black/10 shadow-inner"
        style={{
          background: `linear-gradient(180deg, ${tint.gradientTop} 0%, ${tint.gradientBottom} 100%)`,
        }}
        aria-hidden
      />
      <span className="text-center text-xs font-medium text-foreground">{tint.name}</span>
      {tint.priceSurcharge > 0 && (
        <span className="text-[10px] text-muted-foreground">+${tint.priceSurcharge}</span>
      )}
    </button>
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
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-bold text-foreground">Lens options</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tint is applied dynamically to the lens only — the frame stays unchanged in real time.
        </p>
      </div>

      {polarizedOption && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <div>
            <Label htmlFor="polarized-toggle" className="font-semibold">
              {polarizedOption.label}
            </Label>
            <p className="text-xs text-muted-foreground">
              +${polarizedOption.priceSurcharge}
              {polarizedOption.description ? ` · ${polarizedOption.description}` : ""}
            </p>
          </div>
          <Switch id="polarized-toggle" checked={polarized} onCheckedChange={onPolarizedChange} />
        </div>
      )}

      <Tabs defaultValue="gradient" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="classic">Classic</TabsTrigger>
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
        </TabsList>
        <TabsContent value="classic" className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            {classicTints.map((tint) => (
              <TintSwatch key={tint.id} tint={tint} active={activeTintId === tint.id} onSelect={onSelectTint} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="gradient" className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gradientTints.map((tint) => (
              <TintSwatch key={tint.id} tint={tint} active={activeTintId === tint.id} onSelect={onSelectTint} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {lensDisclaimer && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">* {lensDisclaimer}</p>
      )}
    </div>
  );
}
