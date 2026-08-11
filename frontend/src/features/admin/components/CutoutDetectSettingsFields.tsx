import { Label } from "@/components/ui/label";
import {
  detectBorderPx,
  withDetectBorderPx,
  type CutoutDetectSettings,
} from "@/render/mask/smart-cutout-detect";

export interface CutoutDetectSettingsFieldsProps {
  settings: CutoutDetectSettings;
  onChange: (next: CutoutDetectSettings) => void;
  /** Optional caption under the title. */
  caption?: string;
  className?: string;
}

/**
 * Per-cutout detection controls (Tolerance · Border size · Smooth edge).
 * Expand / Shrink / Feather are folded into Border size.
 */
export function CutoutDetectSettingsFields({
  settings,
  onChange,
  caption,
  className,
}: CutoutDetectSettingsFieldsProps) {
  const border = detectBorderPx(settings);

  return (
    <div className={className}>
      {caption ? <p className="mb-2 text-[10px] text-muted-foreground">{caption}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
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
            onChange={(e) => onChange({ ...settings, tolerance: Number(e.target.value) })}
            className="w-full accent-foreground"
            title="How broadly similar colours are included from the click"
          />
          <p className="text-[9px] leading-snug text-muted-foreground">Colour match range</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Border size</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">
              {border > 0 ? `+${border}` : border}px
            </span>
          </div>
          <input
            type="range"
            min={-8}
            max={8}
            step={1}
            value={border}
            onChange={(e) => onChange(withDetectBorderPx(settings, Number(e.target.value)))}
            className="w-full accent-foreground"
            title="Grow (+) or shrink (−) the selection edge"
          />
          <p className="text-[9px] leading-snug text-muted-foreground">Grow / shrink edge</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Smooth edge</Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{settings.smoothEdge}</span>
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={settings.smoothEdge}
            onChange={(e) => onChange({ ...settings, smoothEdge: Number(e.target.value) })}
            className="w-full accent-foreground"
            title="How much to simplify / soften the polygon outline"
          />
          <p className="text-[9px] leading-snug text-muted-foreground">Polygon outline</p>
        </div>
      </div>
    </div>
  );
}
