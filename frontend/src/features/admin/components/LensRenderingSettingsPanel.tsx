import type { LensClipRenderSettings } from "@bino-foundry/shared/types";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_LENS_CLIP_RENDER } from "@/render/lens-clip/clip-settings";

interface LensRenderingSettingsPanelProps {
  value: LensClipRenderSettings | null | undefined;
  onChange: (next: LensClipRenderSettings) => void;
  className?: string;
  disabled?: boolean;
}

function SliderRow({
  label,
  description,
  value,
  onChange,
  disabled,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="tabular-nums text-[10px] text-muted-foreground">{value.toFixed(2)}</span>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">{description}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-foreground"
      />
    </div>
  );
}

/**
 * High-level material controls stored on clip_config.render.
 * Lighting, gradients, Fresnel width, highlights, and colour neutralization are automatic.
 */
export function LensRenderingSettingsPanel({
  value,
  onChange,
  className,
  disabled,
}: LensRenderingSettingsPanelProps) {
  const merged: Required<
    Pick<
      LensClipRenderSettings,
      | "mode"
      | "tintLayerOpacity"
      | "lensOpacity"
      | "reflectionOpacity"
      | "edgeDarkness"
      | "backgroundVisibility"
      | "environmentTransparency"
      | "centerDensity"
      | "edgeDensity"
    >
  > = {
    mode: value?.mode ?? DEFAULT_LENS_CLIP_RENDER.mode,
    tintLayerOpacity:
      value?.tintLayerOpacity ??
      (value?.tintFilterOpacity == null
        ? DEFAULT_LENS_CLIP_RENDER.tintLayerOpacity
        : DEFAULT_LENS_CLIP_RENDER.tintLayerOpacity * value.tintFilterOpacity),
    lensOpacity:
      value?.lensOpacity ??
      (value?.transparency == null
        ? DEFAULT_LENS_CLIP_RENDER.lensOpacity
        : 1 - value.transparency),
    reflectionOpacity: value?.reflectionOpacity ?? DEFAULT_LENS_CLIP_RENDER.reflectionOpacity,
    edgeDarkness: value?.edgeDarkness ?? DEFAULT_LENS_CLIP_RENDER.edgeDarkness,
    backgroundVisibility:
      value?.backgroundVisibility ?? DEFAULT_LENS_CLIP_RENDER.backgroundVisibility,
    environmentTransparency:
      value?.environmentTransparency ?? DEFAULT_LENS_CLIP_RENDER.environmentTransparency,
    centerDensity: value?.centerDensity ?? DEFAULT_LENS_CLIP_RENDER.centerDensity,
    edgeDensity: value?.edgeDensity ?? DEFAULT_LENS_CLIP_RENDER.edgeDensity,
  };

  const patch = (partial: Partial<LensClipRenderSettings>) => {
    onChange({ ...value, ...merged, ...partial });
  };

  return (
    <div className={cn("space-y-4 rounded-md border border-border/80 bg-muted/20 p-3", className)}>
      <div>
        <p className="type-label text-muted-foreground">Lens rendering</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Starting values from a preset. Sliders stay editable — changing any value on a frame
          switches that frame to Custom Settings.
        </p>
      </div>

      <SliderRow
        label="Tint layer opacity"
        description="Controls the coloured tint layer. Lower values create a lighter lens; higher values create a stronger tint."
        value={merged.tintLayerOpacity}
        disabled={disabled}
        onChange={(tintLayerOpacity) => patch({ tintLayerOpacity })}
      />

      <SliderRow
        label="Lens opacity"
        description="Controls overall lens transparency. Lower values keep more background and internal frame detail visible."
        value={merged.lensOpacity}
        disabled={disabled}
        onChange={(lensOpacity) => patch({ mode: "replace", lensOpacity })}
      />

      <SliderRow
        label="Reflection opacity"
        description="Controls only lens reflection visibility. Higher values create a glossier premium appearance."
        value={merged.reflectionOpacity}
        disabled={disabled}
        onChange={(reflectionOpacity) =>
          patch({ reflectionEnabled: reflectionOpacity > 0, reflectionOpacity })
        }
      />

      <SliderRow
        label="Edge opacity"
        description="Controls only the thin darker rim around the lens edge to improve depth perception."
        value={merged.edgeDarkness}
        disabled={disabled}
        onChange={(edgeDarkness) =>
          patch({ vignetteEnabled: edgeDarkness > 0, edgeDarkness })
        }
      />

      <SliderRow
        label="Background visibility"
        description="How much of the scene behind the lens is visible through the synthetic glass. Never reveals the original lens texture — only background elements rendered behind the lens."
        value={merged.backgroundVisibility}
        disabled={disabled}
        onChange={(backgroundVisibility) => patch({ backgroundVisibility })}
      />

      <SliderRow
        label="Environment transparency"
        description="How transparent the synthetic lens is, affecting the rendered scene behind the lens. Must not reveal the original lens pixels."
        value={merged.environmentTransparency}
        disabled={disabled}
        onChange={(environmentTransparency) => patch({ environmentTransparency })}
      />

      <SliderRow
        label="Edge density"
        description="Makes the outer edges of the lens slightly darker to simulate real lens thickness. Independent of tint opacity."
        value={merged.edgeDensity}
        disabled={disabled}
        onChange={(edgeDensity) => patch({ edgeDensity })}
      />

      <SliderRow
        label="Center density"
        description="Controls the density of the centre of the lens to match premium sunglass optics. Independent of tint opacity."
        value={merged.centerDensity}
        disabled={disabled}
        onChange={(centerDensity) => patch({ centerDensity })}
      />
    </div>
  );
}
