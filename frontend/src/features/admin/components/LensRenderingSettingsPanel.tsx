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
  value,
  onChange,
  disabled,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
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
      | "lensOpacity"
      | "lensTransmission"
      | "frameExclusionOpacity"
      | "reflectionStrength"
      | "reflectionBlur"
      | "edgeDarkness"
    >
  > = {
    mode: value?.mode ?? DEFAULT_LENS_CLIP_RENDER.mode,
    lensOpacity:
      value?.lensOpacity ??
      (value?.transparency == null
        ? DEFAULT_LENS_CLIP_RENDER.lensOpacity
        : 1 - value.transparency),
    lensTransmission:
      value?.lensTransmission ??
      value?.transparency ??
      DEFAULT_LENS_CLIP_RENDER.lensTransmission,
    frameExclusionOpacity:
      value?.frameExclusionOpacity ?? DEFAULT_LENS_CLIP_RENDER.frameExclusionOpacity,
    reflectionStrength: value?.reflectionStrength ?? DEFAULT_LENS_CLIP_RENDER.reflectionStrength,
    reflectionBlur: value?.reflectionBlur ?? DEFAULT_LENS_CLIP_RENDER.reflectionBlur,
    edgeDarkness: value?.edgeDarkness ?? DEFAULT_LENS_CLIP_RENDER.edgeDarkness,
  };

  const patch = (partial: Partial<LensClipRenderSettings>) => {
    onChange({ ...value, ...merged, ...partial });
  };

  return (
    <div className={cn("space-y-4 rounded-md border border-border/80 bg-muted/20 p-3", className)}>
      <div>
        <p className="type-label text-muted-foreground">Lens rendering</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Original lens colour is fully removed. The selected catalogue tint is the only colour
          source; lighting, reflection, and edge depth are generated automatically.
        </p>
      </div>

      <SliderRow
        label="Lens opacity"
        value={merged.lensOpacity}
        disabled={disabled}
        onChange={(lensOpacity) => patch({ mode: "replace", lensOpacity })}
      />

      <SliderRow
        label="Lens transmission"
        value={merged.lensTransmission}
        disabled={disabled}
        onChange={(lensTransmission) => patch({ lensTransmission })}
      />

      <SliderRow
        label="Frame exclusion opacity"
        value={merged.frameExclusionOpacity}
        disabled={disabled}
        onChange={(frameExclusionOpacity) => patch({ frameExclusionOpacity })}
      />

      <SliderRow
        label="Reflection strength"
        value={merged.reflectionStrength}
        disabled={disabled}
        onChange={(reflectionStrength) =>
          patch({ reflectionEnabled: reflectionStrength > 0, reflectionStrength })
        }
      />

      <SliderRow
        label="Reflection blur"
        value={merged.reflectionBlur}
        disabled={disabled}
        onChange={(reflectionBlur) => patch({ reflectionBlur })}
      />

      <SliderRow
        label="Edge darkness"
        value={merged.edgeDarkness}
        disabled={disabled}
        onChange={(edgeDarkness) =>
          patch({ vignetteEnabled: edgeDarkness > 0, edgeDarkness })
        }
      />
    </div>
  );
}
