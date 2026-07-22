import type { LensClipRenderSettings } from "@bino-foundry/shared/types";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_LENS_CLIP_RENDER } from "@/render/lens-clip/clip-settings";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";

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
  formatValue = (n) => n.toFixed(2),
}: {
  label: string;
  description: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (n: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="tabular-nums text-[10px] text-muted-foreground">
          {formatValue(value)}
        </span>
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
 * Glass Material controls for the reusable SVG `#glassMaterial` filter.
 * Hierarchy (frame override → preset → system default) is applied by the caller.
 */
export function LensRenderingSettingsPanel({
  value,
  onChange,
  className,
  disabled,
}: LensRenderingSettingsPanelProps) {
  const { lensMaterialProfiles } = useSunglassesCatalog();
  const merged: Required<
    Pick<
      LensClipRenderSettings,
      | "automaticMaterialBehavior"
      | "originalLensColorInfluence"
      | "baseBrightness"
      | "baseGamma"
      | "glassAbsorption"
      | "glassDiffusion"
      | "glassDepth"
      | "tintLayerOpacity"
      | "lensTransmission"
      | "reflectionEnabled"
      | "reflectionOpacity"
      | "reflectionStrength"
      | "reflectionBlur"
      | "reflectionOffsetX"
      | "reflectionOffsetY"
      | "reflectionScale"
      | "reflectionAngle"
      | "backgroundVisibility"
      | "environmentTransparency"
      | "centerDensity"
      | "edgeDensity"
      | "edgeSoftness"
      | "edgeOpacity"
    >
  > = {
    automaticMaterialBehavior:
      value?.automaticMaterialBehavior ??
      DEFAULT_LENS_CLIP_RENDER.automaticMaterialBehavior,
    originalLensColorInfluence:
      value?.originalLensColorInfluence ??
      DEFAULT_LENS_CLIP_RENDER.originalLensColorInfluence,
    baseBrightness: value?.baseBrightness ?? DEFAULT_LENS_CLIP_RENDER.baseBrightness,
    baseGamma: value?.baseGamma ?? DEFAULT_LENS_CLIP_RENDER.baseGamma,
    glassAbsorption: value?.glassAbsorption ?? DEFAULT_LENS_CLIP_RENDER.glassAbsorption,
    glassDiffusion: value?.glassDiffusion ?? DEFAULT_LENS_CLIP_RENDER.glassDiffusion,
    glassDepth: value?.glassDepth ?? DEFAULT_LENS_CLIP_RENDER.glassDepth,
    tintLayerOpacity: value?.tintLayerOpacity ?? DEFAULT_LENS_CLIP_RENDER.tintLayerOpacity,
    lensTransmission:
      value?.lensTransmission ?? DEFAULT_LENS_CLIP_RENDER.lensTransmission,
    reflectionEnabled:
      value?.reflectionEnabled ?? DEFAULT_LENS_CLIP_RENDER.reflectionEnabled,
    reflectionOpacity:
      value?.reflectionOpacity ?? DEFAULT_LENS_CLIP_RENDER.reflectionOpacity,
    reflectionStrength:
      value?.reflectionStrength ?? DEFAULT_LENS_CLIP_RENDER.reflectionStrength,
    reflectionBlur: value?.reflectionBlur ?? DEFAULT_LENS_CLIP_RENDER.reflectionBlur,
    reflectionOffsetX:
      value?.reflectionOffsetX ?? DEFAULT_LENS_CLIP_RENDER.reflectionOffsetX,
    reflectionOffsetY:
      value?.reflectionOffsetY ?? DEFAULT_LENS_CLIP_RENDER.reflectionOffsetY,
    reflectionScale: value?.reflectionScale ?? DEFAULT_LENS_CLIP_RENDER.reflectionScale,
    reflectionAngle: value?.reflectionAngle ?? DEFAULT_LENS_CLIP_RENDER.reflectionAngle,
    backgroundVisibility:
      value?.backgroundVisibility ?? DEFAULT_LENS_CLIP_RENDER.backgroundVisibility,
    environmentTransparency:
      value?.environmentTransparency ?? DEFAULT_LENS_CLIP_RENDER.environmentTransparency,
    centerDensity: value?.centerDensity ?? DEFAULT_LENS_CLIP_RENDER.centerDensity,
    edgeDensity: value?.edgeDensity ?? DEFAULT_LENS_CLIP_RENDER.edgeDensity,
    edgeSoftness: value?.edgeSoftness ?? DEFAULT_LENS_CLIP_RENDER.edgeSoftness,
    edgeOpacity: value?.edgeOpacity ?? DEFAULT_LENS_CLIP_RENDER.edgeOpacity,
  };

  const patch = (partial: Partial<LensClipRenderSettings>) => {
    onChange({ ...value, ...merged, ...partial });
  };

  return (
    <div className={cn("space-y-4 rounded-md border border-border/80 bg-muted/20 p-3", className)}>
      <div>
        <p className="type-label text-muted-foreground">Lens rendering</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Optical glass is rendered by one reusable SVG material filter. Automatic mode derives
          filter response from Tint Layer Opacity; manual mode uses the values below exactly.
        </p>
      </div>

      <label className="space-y-1 text-xs">
        <span className="font-medium text-foreground">Apply material profile</span>
        <select
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          value=""
          disabled={disabled || lensMaterialProfiles.length === 0}
          onChange={(event) => {
            const profile = lensMaterialProfiles.find((item) => item.id === event.target.value);
            if (profile) onChange({ ...value, ...profile.settings });
          }}
        >
          <option value="">Choose a starting point…</option>
          {lensMaterialProfiles
            .filter((profile) => profile.isActive)
            .map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
        </select>
        <span className="block text-[10px] text-muted-foreground">
          Copies database values into this draft. It does not create a locked relationship.
        </span>
      </label>

      <label className="flex items-start gap-2 rounded border border-border/70 bg-background/50 p-3 text-xs">
        <input
          type="checkbox"
          className="mt-0.5 accent-foreground"
          checked={merged.automaticMaterialBehavior}
          disabled={disabled}
          onChange={(e) => patch({ automaticMaterialBehavior: e.target.checked })}
        />
        <span>
          <span className="font-medium text-foreground">Automatic Material Behaviour</span>
          <span className="mt-0.5 block text-muted-foreground">
            Recommended. Tint density automatically adjusts reflection, edge absorption,
            transmission, and density inside the glass filter.
          </span>
        </span>
      </label>

      <SliderRow
        label="Tint layer opacity"
        description="Controls the coloured tint. Lower values create a lighter lens; higher values create a stronger tint."
        value={merged.tintLayerOpacity}
        disabled={disabled}
        onChange={(tintLayerOpacity) => patch({ tintLayerOpacity })}
      />

      <SliderRow
        label="Original Lens Colour Influence"
        description="How much source-lens hue remains before tinting. 0% = neutral luminance only; 100% keeps the original cast."
        value={merged.originalLensColorInfluence}
        min={0}
        max={100}
        step={1}
        formatValue={(n) => `${Math.round(n)}%`}
        disabled={disabled}
        onChange={(originalLensColorInfluence) => patch({ originalLensColorInfluence })}
      />

      {!merged.automaticMaterialBehavior ? (
        <div className="space-y-4 rounded border border-border/70 bg-background/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Manual source calibration
          </p>
          <SliderRow
            label="Base brightness"
            description="Brightens or darkens the original lens before tinting."
            value={merged.baseBrightness}
            min={-100}
            max={100}
            step={1}
            formatValue={(n) => `${n > 0 ? "+" : ""}${Math.round(n)}`}
            disabled={disabled}
            onChange={(baseBrightness) => patch({ baseBrightness })}
          />
          <SliderRow
            label="Base gamma"
            description="Tonal response for unusually dark or light source plates."
            value={merged.baseGamma}
            min={0.5}
            max={2.5}
            step={0.01}
            formatValue={(n) => n.toFixed(2)}
            disabled={disabled}
            onChange={(baseGamma) => patch({ baseGamma })}
          />
        </div>
      ) : null}

      {merged.automaticMaterialBehavior ? (
        <p className="rounded border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          Glass Material and reflection response are derived live from tint opacity. Disable
          Automatic Material Behaviour for full artistic control.
        </p>
      ) : (
        <div className="space-y-4 rounded border border-border/70 bg-background/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Glass Material
          </p>

          <SliderRow
            label="Glass Transmission"
            description="How much environment light remains visible through the glass."
            value={merged.lensTransmission}
            formatValue={(n) => `${Math.round(n * 100)}%`}
            disabled={disabled}
            onChange={(lensTransmission) => patch({ lensTransmission })}
          />
          <SliderRow
            label="Glass Absorption"
            description="Light absorbed by the glass body — richer depth without simply raising opacity."
            value={merged.glassAbsorption}
            min={0}
            max={100}
            step={1}
            formatValue={(n) => `${Math.round(n)}%`}
            disabled={disabled}
            onChange={(glassAbsorption) => patch({ glassAbsorption })}
          />
          <SliderRow
            label="Glass Density"
            description="Perceived optical thickness inside the material filter."
            value={merged.glassDepth}
            min={0}
            max={100}
            step={1}
            formatValue={(n) => `${Math.round(n)}%`}
            disabled={disabled}
            onChange={(glassDepth) => patch({ glassDepth })}
          />
          <SliderRow
            label="Glass Diffusion"
            description="Internal softness / light scatter in the filter."
            value={merged.glassDiffusion}
            min={0}
            max={100}
            step={1}
            formatValue={(n) => `${Math.round(n)}%`}
            disabled={disabled}
            onChange={(glassDiffusion) => patch({ glassDiffusion })}
          />
          <SliderRow
            label="Center Density"
            description="Density at the optical centre."
            value={merged.centerDensity}
            formatValue={(n) => `${Math.round(n * 100)}%`}
            disabled={disabled}
            onChange={(centerDensity) => patch({ centerDensity })}
          />
          <SliderRow
            label="Edge Density"
            description="Extra density at the perimeter from the longer light path."
            value={merged.edgeDensity}
            formatValue={(n) => `${Math.round(n * 100)}%`}
            disabled={disabled}
            onChange={(edgeDensity) => patch({ edgeDensity })}
          />
          <SliderRow
            label="Edge Softness"
            description="Feathering of the edge-absorption response in the filter."
            value={merged.edgeSoftness}
            formatValue={(n) => `${Math.round(n * 100)}%`}
            disabled={disabled}
            onChange={(edgeSoftness) => patch({ edgeSoftness })}
          />
          <SliderRow
            label="Environment Visibility"
            description="How much of the scene shows through the synthetic glass."
            value={Math.max(merged.environmentTransparency, merged.backgroundVisibility)}
            formatValue={(n) => `${Math.round(n * 100)}%`}
            disabled={disabled}
            onChange={(environmentVisibility) =>
              patch({
                environmentTransparency: environmentVisibility,
                backgroundVisibility: environmentVisibility,
              })
            }
          />

          <label className="flex items-start gap-2 rounded border border-border/60 bg-muted/10 p-3 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 accent-foreground"
              checked={merged.reflectionEnabled}
              disabled={disabled}
              onChange={(e) => patch({ reflectionEnabled: e.target.checked })}
            />
            <span>
              <span className="font-medium text-foreground">Enable Reflection</span>
              <span className="mt-0.5 block text-muted-foreground">
                Adds a configurable specular catch-light inside the glass material filter.
                When off, the filter skips reflection entirely.
              </span>
            </span>
          </label>

          {merged.reflectionEnabled ? (
            <div className="space-y-4 border-t border-border/50 pt-3">
              <SliderRow
                label="Reflection Opacity"
                description="Overall visibility of the filter reflection module."
                value={merged.reflectionOpacity}
                formatValue={(n) => `${Math.round(n * 100)}%`}
                disabled={disabled}
                onChange={(reflectionOpacity) => patch({ reflectionOpacity })}
              />
              <SliderRow
                label="Reflection Softness"
                description="Blur of the specular catch-light."
                value={merged.reflectionBlur}
                formatValue={(n) => `${Math.round(n * 100)}%`}
                disabled={disabled}
                onChange={(reflectionBlur) => patch({ reflectionBlur })}
              />
              <SliderRow
                label="Reflection Intensity"
                description="Highlight energy inside the reflection module."
                value={merged.reflectionStrength}
                formatValue={(n) => `${Math.round(n * 100)}%`}
                disabled={disabled}
                onChange={(reflectionStrength) => patch({ reflectionStrength })}
              />
              <SliderRow
                label="Reflection Scale"
                description="Size / distance of the catch-light."
                value={merged.reflectionScale}
                min={0.5}
                max={1.75}
                step={0.01}
                formatValue={(n) => `${Math.round(n * 100)}%`}
                disabled={disabled}
                onChange={(reflectionScale) => patch({ reflectionScale })}
              />
              <SliderRow
                label="Reflection Rotation"
                description="Rotates the catch-light around the optical surface."
                value={merged.reflectionAngle}
                min={0}
                max={360}
                step={1}
                formatValue={(n) => `${Math.round(n)}°`}
                disabled={disabled}
                onChange={(reflectionAngle) => patch({ reflectionAngle })}
              />
              <SliderRow
                label="Reflection Offset X"
                description="Moves the catch-light horizontally."
                value={merged.reflectionOffsetX}
                min={-100}
                max={100}
                step={1}
                formatValue={(n) => `${n > 0 ? "+" : ""}${Math.round(n)}`}
                disabled={disabled}
                onChange={(reflectionOffsetX) => patch({ reflectionOffsetX })}
              />
              <SliderRow
                label="Reflection Offset Y"
                description="Moves the catch-light vertically."
                value={merged.reflectionOffsetY}
                min={-100}
                max={100}
                step={1}
                formatValue={(n) => `${n > 0 ? "+" : ""}${Math.round(n)}`}
                disabled={disabled}
                onChange={(reflectionOffsetY) => patch({ reflectionOffsetY })}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
