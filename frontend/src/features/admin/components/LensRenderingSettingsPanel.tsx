import type { LensClipRenderSettings } from "@bino-foundry/shared/types";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

function ToggleRow({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/**
 * Frame-level synthetic lens optics (stored on clip_config.render).
 * Customer tint colours still come from the tint catalogue.
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
      | "tintOpacity"
      | "gradientEnabled"
      | "gradientPosition"
      | "reflectionEnabled"
      | "reflectionOpacity"
      | "reflectionBlur"
      | "glossEnabled"
      | "glossIntensity"
      | "vignetteEnabled"
      | "vignetteStrength"
      | "polarizedEnabled"
      | "polarizedStrength"
    >
  > = {
    mode: value?.mode ?? DEFAULT_LENS_CLIP_RENDER.mode,
    tintOpacity: value?.tintOpacity ?? value?.lensOpacity ?? DEFAULT_LENS_CLIP_RENDER.tintOpacity,
    gradientEnabled: value?.gradientEnabled ?? DEFAULT_LENS_CLIP_RENDER.gradientEnabled,
    gradientPosition: value?.gradientPosition ?? DEFAULT_LENS_CLIP_RENDER.gradientPosition,
    reflectionEnabled: value?.reflectionEnabled ?? DEFAULT_LENS_CLIP_RENDER.reflectionEnabled,
    reflectionOpacity: value?.reflectionOpacity ?? DEFAULT_LENS_CLIP_RENDER.reflectionOpacity,
    reflectionBlur: value?.reflectionBlur ?? DEFAULT_LENS_CLIP_RENDER.reflectionBlur,
    glossEnabled: value?.glossEnabled ?? DEFAULT_LENS_CLIP_RENDER.glossEnabled,
    glossIntensity: value?.glossIntensity ?? DEFAULT_LENS_CLIP_RENDER.glossIntensity,
    vignetteEnabled: value?.vignetteEnabled ?? DEFAULT_LENS_CLIP_RENDER.vignetteEnabled,
    vignetteStrength: value?.vignetteStrength ?? DEFAULT_LENS_CLIP_RENDER.vignetteStrength,
    polarizedEnabled: value?.polarizedEnabled ?? DEFAULT_LENS_CLIP_RENDER.polarizedEnabled,
    polarizedStrength: value?.polarizedStrength ?? DEFAULT_LENS_CLIP_RENDER.polarizedStrength,
  };

  const patch = (partial: Partial<LensClipRenderSettings>) => {
    onChange({ ...value, ...merged, ...partial });
  };

  return (
    <div className={cn("space-y-4 rounded-md border border-border/80 bg-muted/20 p-3", className)}>
      <div>
        <p className="type-label text-muted-foreground">Lens rendering</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Replace mode knocks out the photo lenses and paints a synthetic lens inside your clip
          polygons. Tint colours still come from the customer tint catalogue.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-xs",
            merged.mode === "replace"
              ? "border-foreground bg-background font-medium"
              : "border-border text-muted-foreground",
          )}
          onClick={() => patch({ mode: "replace" })}
        >
          Replace lens
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-xs",
            merged.mode === "overlay"
              ? "border-foreground bg-background font-medium"
              : "border-border text-muted-foreground",
          )}
          onClick={() => patch({ mode: "overlay" })}
        >
          Legacy overlay
        </button>
      </div>

      <SliderRow
        label="Tint opacity multiplier"
        value={merged.tintOpacity}
        disabled={disabled}
        onChange={(tintOpacity) => patch({ tintOpacity })}
      />

      <ToggleRow
        label="Gradient"
        checked={merged.gradientEnabled}
        disabled={disabled}
        onCheckedChange={(gradientEnabled) => patch({ gradientEnabled })}
      />
      {merged.gradientEnabled ? (
        <SliderRow
          label="Gradient mid position"
          value={merged.gradientPosition}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          onChange={(gradientPosition) => patch({ gradientPosition })}
        />
      ) : null}

      <ToggleRow
        label="Reflection"
        checked={merged.reflectionEnabled}
        disabled={disabled}
        onCheckedChange={(reflectionEnabled) => patch({ reflectionEnabled })}
      />
      {merged.reflectionEnabled ? (
        <>
          <SliderRow
            label="Reflection opacity"
            value={merged.reflectionOpacity}
            disabled={disabled}
            onChange={(reflectionOpacity) => patch({ reflectionOpacity })}
          />
          <SliderRow
            label="Reflection blur"
            value={merged.reflectionBlur}
            disabled={disabled}
            onChange={(reflectionBlur) => patch({ reflectionBlur })}
          />
        </>
      ) : null}

      <ToggleRow
        label="Gloss"
        checked={merged.glossEnabled}
        disabled={disabled}
        onCheckedChange={(glossEnabled) => patch({ glossEnabled })}
      />
      {merged.glossEnabled ? (
        <SliderRow
          label="Gloss intensity"
          value={merged.glossIntensity}
          disabled={disabled}
          onChange={(glossIntensity) => patch({ glossIntensity })}
        />
      ) : null}

      <ToggleRow
        label="Edge vignette"
        checked={merged.vignetteEnabled}
        disabled={disabled}
        onCheckedChange={(vignetteEnabled) => patch({ vignetteEnabled })}
      />
      {merged.vignetteEnabled ? (
        <SliderRow
          label="Vignette strength"
          value={merged.vignetteStrength}
          disabled={disabled}
          onChange={(vignetteStrength) => patch({ vignetteStrength })}
        />
      ) : null}

      <ToggleRow
        label="Polarized sheen"
        checked={merged.polarizedEnabled}
        disabled={disabled}
        onCheckedChange={(polarizedEnabled) => patch({ polarizedEnabled })}
      />
      {merged.polarizedEnabled ? (
        <SliderRow
          label="Polarized strength"
          value={merged.polarizedStrength}
          disabled={disabled}
          onChange={(polarizedStrength) => patch({ polarizedStrength })}
        />
      ) : null}
    </div>
  );
}
