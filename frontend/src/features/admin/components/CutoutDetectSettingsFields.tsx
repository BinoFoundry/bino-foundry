import { Label } from "@/components/ui/label";
import type { CutoutDetectSettings } from "@/render/mask/smart-cutout-detect";

export interface CutoutDetectSettingsFieldsProps {
  settings: CutoutDetectSettings;
  onChange: (next: CutoutDetectSettings) => void;
  /** Optional caption under the title. */
  caption?: string;
  className?: string;
}

/**
 * Per-cutout detection controls. Parent must pass settings owned by the active cutout only.
 */
export function CutoutDetectSettingsFields({
  settings,
  onChange,
  caption,
  className,
}: CutoutDetectSettingsFieldsProps) {
  const patch = (partial: Partial<CutoutDetectSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className={className}>
      {caption ? <p className="mb-2 text-[10px] text-muted-foreground">{caption}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Tolerance</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{settings.tolerance}</span>
          </div>
          <input
            type="range"
            min={8}
            max={90}
            step={1}
            value={settings.tolerance}
            onChange={(e) => patch({ tolerance: Number(e.target.value) })}
            className="w-full accent-foreground"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Expand</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{settings.expand}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={settings.expand}
            onChange={(e) => patch({ expand: Number(e.target.value) })}
            className="w-full accent-foreground"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Shrink</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{settings.shrink}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={settings.shrink}
            onChange={(e) => patch({ shrink: Number(e.target.value) })}
            className="w-full accent-foreground"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Feather</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{settings.feather}</span>
          </div>
          <input
            type="range"
            min={0}
            max={6}
            step={0.1}
            value={settings.feather}
            onChange={(e) => patch({ feather: Number(e.target.value) })}
            className="w-full accent-foreground"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Smooth Edge</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{settings.smoothEdge}</span>
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={settings.smoothEdge}
            onChange={(e) => patch({ smoothEdge: Number(e.target.value) })}
            className="w-full accent-foreground"
          />
        </div>
      </div>
    </div>
  );
}
