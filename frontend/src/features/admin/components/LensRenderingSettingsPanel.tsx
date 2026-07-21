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
      | "lensOpacity"
      | "frameExclusionOpacity"
      | "transparency"
      | "brightness"
      | "contrast"
      | "saturation"
      | "gradientEnabled"
      | "gradientPosition"
      | "gradientStrength"
      | "reflectionEnabled"
      | "reflectionStrength"
      | "reflectionOpacity"
      | "reflectionAngle"
      | "reflectionBlur"
      | "glossEnabled"
      | "glossStrength"
      | "highlightStrength"
      | "vignetteEnabled"
      | "edgeFade"
      | "polarizedEnabled"
      | "polarizedStrength"
    >
  > = {
    mode: value?.mode ?? DEFAULT_LENS_CLIP_RENDER.mode,
    tintOpacity: value?.tintOpacity ?? DEFAULT_LENS_CLIP_RENDER.tintOpacity,
    lensOpacity:
      value?.lensOpacity ??
      (value?.transparency == null
        ? DEFAULT_LENS_CLIP_RENDER.lensOpacity
        : 1 - value.transparency),
    frameExclusionOpacity:
      value?.frameExclusionOpacity ?? DEFAULT_LENS_CLIP_RENDER.frameExclusionOpacity,
    transparency:
      value?.transparency ??
      (value?.baseTintOpacity == null
        ? DEFAULT_LENS_CLIP_RENDER.transparency
        : 1 - value.baseTintOpacity),
    brightness: value?.brightness ?? DEFAULT_LENS_CLIP_RENDER.brightness,
    contrast: value?.contrast ?? DEFAULT_LENS_CLIP_RENDER.contrast,
    saturation: value?.saturation ?? DEFAULT_LENS_CLIP_RENDER.saturation,
    gradientEnabled: value?.gradientEnabled ?? DEFAULT_LENS_CLIP_RENDER.gradientEnabled,
    gradientPosition: value?.gradientPosition ?? DEFAULT_LENS_CLIP_RENDER.gradientPosition,
    gradientStrength: value?.gradientStrength ?? DEFAULT_LENS_CLIP_RENDER.gradientStrength,
    reflectionEnabled: value?.reflectionEnabled ?? DEFAULT_LENS_CLIP_RENDER.reflectionEnabled,
    reflectionStrength: value?.reflectionStrength ?? DEFAULT_LENS_CLIP_RENDER.reflectionStrength,
    reflectionOpacity: value?.reflectionOpacity ?? DEFAULT_LENS_CLIP_RENDER.reflectionOpacity,
    reflectionAngle: value?.reflectionAngle ?? DEFAULT_LENS_CLIP_RENDER.reflectionAngle,
    reflectionBlur: value?.reflectionBlur ?? DEFAULT_LENS_CLIP_RENDER.reflectionBlur,
    glossEnabled: value?.glossEnabled ?? DEFAULT_LENS_CLIP_RENDER.glossEnabled,
    glossStrength:
      value?.glossStrength ?? value?.glossIntensity ?? DEFAULT_LENS_CLIP_RENDER.glossStrength,
    highlightStrength: value?.highlightStrength ?? DEFAULT_LENS_CLIP_RENDER.highlightStrength,
    vignetteEnabled: value?.vignetteEnabled ?? DEFAULT_LENS_CLIP_RENDER.vignetteEnabled,
    edgeFade: value?.edgeFade ?? value?.vignetteStrength ?? DEFAULT_LENS_CLIP_RENDER.edgeFade,
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
          The source lens is removed completely, then a synthetic glass material is painted
          inside the clip. Source lens colour never contributes to the replacement.
        </p>
      </div>

      <SliderRow
        label="Lens opacity"
        value={merged.lensOpacity}
        disabled={disabled}
        onChange={(lensOpacity) => patch({ mode: "replace", lensOpacity })}
      />

      <SliderRow
        label="Frame exclusion opacity"
        value={merged.frameExclusionOpacity}
        disabled={disabled}
        onChange={(frameExclusionOpacity) => patch({ frameExclusionOpacity })}
      />

      <SliderRow
        label="Tint strength"
        value={merged.tintOpacity}
        disabled={disabled}
        onChange={(tintOpacity) => patch({ tintOpacity })}
      />

      <SliderRow
        label="Brightness"
        value={merged.brightness}
        min={0.25}
        max={2}
        disabled={disabled}
        onChange={(brightness) => patch({ brightness })}
      />
      <SliderRow
        label="Contrast"
        value={merged.contrast}
        max={2}
        disabled={disabled}
        onChange={(contrast) => patch({ contrast })}
      />
      <SliderRow
        label="Saturation"
        value={merged.saturation}
        max={2}
        disabled={disabled}
        onChange={(saturation) => patch({ saturation })}
      />

      <ToggleRow
        label="Gradient"
        checked={merged.gradientEnabled}
        disabled={disabled}
        onCheckedChange={(gradientEnabled) => patch({ gradientEnabled })}
      />
      {merged.gradientEnabled ? (
        <>
          <SliderRow
            label="Gradient mid position"
            value={merged.gradientPosition}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            onChange={(gradientPosition) => patch({ gradientPosition })}
          />
          <SliderRow
            label="Gradient strength"
            value={merged.gradientStrength}
            disabled={disabled}
            onChange={(gradientStrength) => patch({ gradientStrength })}
          />
        </>
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
            label="Reflection strength"
            value={merged.reflectionStrength}
            disabled={disabled}
            onChange={(reflectionStrength) => patch({ reflectionStrength })}
          />
          <SliderRow
            label="Reflection opacity"
            value={merged.reflectionOpacity}
            disabled={disabled}
            onChange={(reflectionOpacity) => patch({ reflectionOpacity })}
          />
          <SliderRow
            label="Reflection angle"
            value={merged.reflectionAngle}
            min={0}
            max={360}
            step={1}
            disabled={disabled}
            onChange={(reflectionAngle) => patch({ reflectionAngle })}
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
        <>
          <SliderRow
            label="Glass highlight"
            value={merged.glossStrength}
            disabled={disabled}
            onChange={(glossStrength) => patch({ glossStrength })}
          />
          <SliderRow
            label="Specular highlight"
            value={merged.highlightStrength}
            disabled={disabled}
            onChange={(highlightStrength) => patch({ highlightStrength })}
          />
        </>
      ) : null}

      <ToggleRow
        label="Edge vignette"
        checked={merged.vignetteEnabled}
        disabled={disabled}
        onCheckedChange={(vignetteEnabled) => patch({ vignetteEnabled })}
      />
      {merged.vignetteEnabled ? (
        <SliderRow
          label="Edge fade"
          value={merged.edgeFade}
          disabled={disabled}
          onChange={(edgeFade) => patch({ edgeFade })}
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
