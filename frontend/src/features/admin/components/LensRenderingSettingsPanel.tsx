import type { ReactNode } from "react";
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
  max = 100,
  step = 1,
  formatValue = (n) => `${Math.round(n)}%`,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (n: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="tabular-nums text-[10px] text-muted-foreground">
          {formatValue(value)}
        </span>
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

function ToolGroup({
  label,
  valueLabel,
  children,
}: {
  label: string;
  valueLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{valueLabel}</span>
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function ToolButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1 text-[10px] font-medium transition-colors",
        active
          ? "border-foreground/40 bg-foreground text-background"
          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40",
        disabled && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function LayerCard({
  title,
  description,
  enabled,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded border border-border/70 bg-background/50 p-3",
        !enabled && "opacity-70",
      )}
    >
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5 accent-foreground"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span>
          <span className="font-medium text-foreground">{title}</span>
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
            {description}
          </span>
        </span>
      </label>
      {enabled ? <div className="space-y-3 pl-5">{children}</div> : null}
    </div>
  );
}

const TINT_BLEND_LABELS: Record<
  NonNullable<LensClipRenderSettings["glassTintBlend"]>,
  string
> = {
  kaca: "Glass",
  color: "Color",
  "source-over": "Normal",
  multiply: "Multiply",
};

/**
 * Glass material layer controls for Lens Rendering Presets and Frame Overrides.
 * Customer tint HEX stays outside this panel (live preview / catalogue).
 */
export function LensRenderingSettingsPanel({
  value,
  onChange,
  className,
  disabled,
}: LensRenderingSettingsPanelProps) {
  const tintEnabled = value?.glassTintEnabled ?? DEFAULT_LENS_CLIP_RENDER.glassTintEnabled;
  const tintOpacity = Math.round(
    (value?.tintLayerOpacity ?? DEFAULT_LENS_CLIP_RENDER.tintLayerOpacity) * 100,
  );
  const tintBlend = value?.glassTintBlend ?? DEFAULT_LENS_CLIP_RENDER.glassTintBlend;
  const tintDepth = value?.glassDepth ?? DEFAULT_LENS_CLIP_RENDER.glassDepth;
  const tintShine = value?.glassTintShine ?? DEFAULT_LENS_CLIP_RENDER.glassTintShine;

  const darkEnabled = value?.darkLayerEnabled ?? DEFAULT_LENS_CLIP_RENDER.darkLayerEnabled;
  const darkOpacity = value?.darkLayerOpacity ?? DEFAULT_LENS_CLIP_RENDER.darkLayerOpacity;
  const darkMode = value?.darkLayerMode ?? DEFAULT_LENS_CLIP_RENDER.darkLayerMode;
  const darkColor = value?.darkLayerColor ?? DEFAULT_LENS_CLIP_RENDER.darkLayerColor;
  const darkBlend = value?.darkLayerBlend ?? DEFAULT_LENS_CLIP_RENDER.darkLayerBlend;
  const darkGlow = value?.darkLayerGlow ?? DEFAULT_LENS_CLIP_RENDER.darkLayerGlow;
  const darkGlowSize = value?.darkLayerGlowSize ?? DEFAULT_LENS_CLIP_RENDER.darkLayerGlowSize;
  const darkGlowX = value?.darkLayerGlowX ?? DEFAULT_LENS_CLIP_RENDER.darkLayerGlowX;
  const darkGlowY = value?.darkLayerGlowY ?? DEFAULT_LENS_CLIP_RENDER.darkLayerGlowY;
  const darkSoft = value?.darkLayerSoft ?? DEFAULT_LENS_CLIP_RENDER.darkLayerSoft;
  const darkEdge = value?.darkLayerEdge ?? DEFAULT_LENS_CLIP_RENDER.darkLayerEdge;

  const reflectionEnabled =
    value?.reflectionEnabled ?? DEFAULT_LENS_CLIP_RENDER.reflectionEnabled;
  const reflectionOpacity = Math.round(
    (value?.reflectionOpacity ?? DEFAULT_LENS_CLIP_RENDER.reflectionOpacity) * 100,
  );

  const edgeEnabled = value?.edgeEnabled ?? DEFAULT_LENS_CLIP_RENDER.edgeEnabled;
  const edgeDensity = Math.round(
    (value?.edgeDensity ?? DEFAULT_LENS_CLIP_RENDER.edgeDensity) * 100,
  );
  const edgeOpacity = Math.round(
    (value?.edgeOpacity ?? DEFAULT_LENS_CLIP_RENDER.edgeOpacity) * 100,
  );

  const densityEnabled =
    value?.densityGradientEnabled ?? DEFAULT_LENS_CLIP_RENDER.densityGradientEnabled;
  const densityMode = value?.densityGradientMode ?? DEFAULT_LENS_CLIP_RENDER.densityGradientMode;
  const densityAngle =
    value?.densityGradientAngle ?? DEFAULT_LENS_CLIP_RENDER.densityGradientAngle;
  const densityStart =
    value?.densityGradientStartColor ?? DEFAULT_LENS_CLIP_RENDER.densityGradientStartColor ?? "#1E1E1E";
  const densityEnd =
    value?.densityGradientEndColor ?? DEFAULT_LENS_CLIP_RENDER.densityGradientEndColor ?? "#4B4B4B";
  const densityPosition =
    value?.densityGradientPosition ?? DEFAULT_LENS_CLIP_RENDER.densityGradientPosition;
  const densityStartFalloff =
    value?.densityGradientStartFalloff ??
    value?.densityGradientStrength ??
    DEFAULT_LENS_CLIP_RENDER.densityGradientStartFalloff;
  const densityEndFalloff =
    value?.densityGradientEndFalloff ??
    value?.densityGradientStrength ??
    DEFAULT_LENS_CLIP_RENDER.densityGradientEndFalloff;
  const densityCurve =
    value?.densityGradientCurve ?? DEFAULT_LENS_CLIP_RENDER.densityGradientCurve;

  const backgroundVisibility = Math.round(
    Math.max(
      value?.backgroundVisibility ?? DEFAULT_LENS_CLIP_RENDER.backgroundVisibility,
      value?.environmentTransparency ?? DEFAULT_LENS_CLIP_RENDER.environmentTransparency,
    ) * 100,
  );

  const patch = (partial: Partial<LensClipRenderSettings>) => {
    onChange({
      ...value,
      automaticMaterialBehavior: false,
      ...partial,
    });
  };

  return (
    <div className={cn("space-y-3 rounded-md border border-border/80 bg-muted/20 p-3", className)}>
      <div>
        <p className="type-label text-muted-foreground">Glass material layers</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Layers enhance the original lens. Use the live preview tint colour to try HEX values —
          the customer’s selected tint remains the final colour.
        </p>
      </div>

      <LayerCard
        title="Tint layer"
        description="Colour, depth, and surface shine applied over the original lens."
        enabled={tintEnabled}
        disabled={disabled}
        onToggle={(glassTintEnabled) => patch({ glassTintEnabled })}
      >
        <SliderRow
          label="Opacity"
          value={tintOpacity}
          disabled={disabled}
          onChange={(pct) => patch({ tintLayerOpacity: pct / 100, tintOpacity: pct / 100 })}
        />
        <ToolGroup label="Blend mode" valueLabel={TINT_BLEND_LABELS[tintBlend]}>
          {(
            [
              ["kaca", "Glass"],
              ["color", "Color"],
              ["source-over", "Normal"],
              ["multiply", "Multiply"],
            ] as const
          ).map(([mode, label]) => (
            <ToolButton
              key={mode}
              active={tintBlend === mode}
              disabled={disabled}
              onClick={() => patch({ glassTintBlend: mode })}
            >
              {label}
            </ToolButton>
          ))}
        </ToolGroup>
        <SliderRow
          label="Glass depth"
          value={tintDepth}
          disabled={disabled}
          onChange={(glassDepth) => patch({ glassDepth })}
        />
        <SliderRow
          label="Surface shine"
          value={tintShine}
          disabled={disabled}
          onChange={(glassTintShine) => patch({ glassTintShine })}
        />
      </LayerCard>

      <LayerCard
        title="Dark layer"
        description="Dark glass body with an optional graduated sheen."
        enabled={darkEnabled}
        disabled={disabled}
        onToggle={(darkLayerEnabled) => patch({ darkLayerEnabled })}
      >
        <ToolGroup
          label="Mode"
          valueLabel={darkMode === "gradasi" ? "gradient" : "flat"}
        >
          <ToolButton
            active={darkMode === "flat"}
            disabled={disabled}
            onClick={() => patch({ darkLayerMode: "flat" })}
          >
            Flat
          </ToolButton>
          <ToolButton
            active={darkMode === "gradasi"}
            disabled={disabled}
            onClick={() => patch({ darkLayerMode: "gradasi" })}
          >
            Gradient
          </ToolButton>
        </ToolGroup>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Colour</Label>
          <input
            type="color"
            value={darkColor}
            disabled={disabled}
            onChange={(e) =>
              patch({
                darkLayerColor: e.target.value.toUpperCase(),
                baseGlassDarkness: darkOpacity,
              })
            }
            className="h-7 w-10 cursor-pointer rounded border border-border/70 bg-transparent"
          />
          <input
            type="text"
            value={darkColor}
            disabled={disabled}
            maxLength={7}
            onChange={(e) => {
              const next = e.target.value.trim();
              if (/^#[0-9A-Fa-f]{6}$/.test(next)) {
                patch({ darkLayerColor: next.toUpperCase() });
              }
            }}
            className="h-7 flex-1 rounded border border-border/70 bg-background px-2 font-mono text-[10px]"
          />
        </div>
        <SliderRow
          label="Opacity"
          value={darkOpacity}
          disabled={disabled}
          onChange={(darkLayerOpacity) =>
            patch({ darkLayerOpacity, baseGlassDarkness: darkLayerOpacity })
          }
        />
        <ToolGroup
          label="Blend mode"
          valueLabel={darkBlend === "source-over" ? "normal" : "multiply"}
        >
          <ToolButton
            active={darkBlend === "source-over"}
            disabled={disabled}
            onClick={() => patch({ darkLayerBlend: "source-over" })}
          >
            Normal
          </ToolButton>
          <ToolButton
            active={darkBlend === "multiply"}
            disabled={disabled}
            onClick={() => patch({ darkLayerBlend: "multiply" })}
          >
            Multiply
          </ToolButton>
        </ToolGroup>
        {darkMode === "gradasi" ? (
          <>
            <SliderRow
              label="Glass sheen"
              value={darkGlow}
              disabled={disabled}
              onChange={(darkLayerGlow) => patch({ darkLayerGlow })}
            />
            <SliderRow
              label="Sheen band width"
              value={darkGlowSize}
              min={15}
              disabled={disabled}
              onChange={(darkLayerGlowSize) => patch({ darkLayerGlowSize })}
            />
            <SliderRow
              label="Sheen position X"
              value={darkGlowX}
              min={10}
              max={90}
              disabled={disabled}
              onChange={(darkLayerGlowX) => patch({ darkLayerGlowX })}
            />
            <SliderRow
              label="Sheen position Y"
              value={darkGlowY}
              min={10}
              max={90}
              disabled={disabled}
              onChange={(darkLayerGlowY) => patch({ darkLayerGlowY })}
            />
            <SliderRow
              label="Soft gradient"
              value={darkSoft}
              min={10}
              disabled={disabled}
              onChange={(darkLayerSoft) => patch({ darkLayerSoft })}
            />
            <SliderRow
              label="Bottom edge dark"
              value={darkEdge}
              disabled={disabled}
              onChange={(darkLayerEdge) => patch({ darkLayerEdge })}
            />
          </>
        ) : null}
      </LayerCard>

      <LayerCard
        title="Density gradient"
        description="Optical density transition across the lens. Start and end falloff control each side independently."
        enabled={densityEnabled}
        disabled={disabled}
        onToggle={(densityGradientEnabled) =>
          patch({
            densityGradientEnabled,
            // Colours are always part of the gradient when enabled.
            densityGradientTwoColor: true,
          })
        }
      >
        <ToolGroup
          label="Direction"
          valueLabel={
            densityMode === "angle"
              ? "custom angle"
              : densityMode === "none"
                ? "none"
                : densityMode
          }
        >
          {(
            [
              ["none", "None"],
              ["vertical", "Vertical"],
              ["horizontal", "Horizontal"],
              ["radial", "Radial"],
              ["angle", "Custom angle"],
            ] as const
          ).map(([mode, label]) => (
            <ToolButton
              key={mode}
              active={densityMode === mode}
              disabled={disabled}
              onClick={() => patch({ densityGradientMode: mode })}
            >
              {label}
            </ToolButton>
          ))}
        </ToolGroup>
        {densityMode === "angle" ? (
          <SliderRow
            label="Angle"
            value={densityAngle}
            max={360}
            disabled={disabled}
            formatValue={(n) => `${Math.round(n)}°`}
            onChange={(densityGradientAngle) => patch({ densityGradientAngle })}
          />
        ) : null}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="w-16 shrink-0 text-xs text-muted-foreground">Start</Label>
            <input
              type="color"
              value={densityStart}
              disabled={disabled}
              onChange={(e) =>
                patch({
                  densityGradientStartColor: e.target.value.toUpperCase(),
                  densityGradientTwoColor: true,
                })
              }
              className="h-7 w-10 cursor-pointer rounded border border-border/70 bg-transparent"
            />
            <input
              type="text"
              value={densityStart}
              disabled={disabled}
              maxLength={7}
              onChange={(e) => {
                const next = e.target.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(next)) {
                  patch({
                    densityGradientStartColor: next.toUpperCase(),
                    densityGradientTwoColor: true,
                  });
                }
              }}
              className="h-7 flex-1 rounded border border-border/70 bg-background px-2 font-mono text-[10px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-16 shrink-0 text-xs text-muted-foreground">End</Label>
            <input
              type="color"
              value={densityEnd}
              disabled={disabled}
              onChange={(e) =>
                patch({
                  densityGradientEndColor: e.target.value.toUpperCase(),
                  densityGradientTwoColor: true,
                })
              }
              className="h-7 w-10 cursor-pointer rounded border border-border/70 bg-transparent"
            />
            <input
              type="text"
              value={densityEnd}
              disabled={disabled}
              maxLength={7}
              onChange={(e) => {
                const next = e.target.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(next)) {
                  patch({
                    densityGradientEndColor: next.toUpperCase(),
                    densityGradientTwoColor: true,
                  });
                }
              }}
              className="h-7 flex-1 rounded border border-border/70 bg-background px-2 font-mono text-[10px]"
            />
          </div>
        </div>
        <SliderRow
          label="Position"
          value={densityPosition}
          disabled={disabled}
          onChange={(densityGradientPosition) => patch({ densityGradientPosition })}
        />
        <SliderRow
          label="Start falloff"
          value={densityStartFalloff}
          disabled={disabled}
          onChange={(densityGradientStartFalloff) =>
            patch({ densityGradientStartFalloff, densityGradientStrength: densityGradientStartFalloff })
          }
        />
        <SliderRow
          label="End falloff"
          value={densityEndFalloff}
          disabled={disabled}
          onChange={(densityGradientEndFalloff) => patch({ densityGradientEndFalloff })}
        />
        <ToolGroup
          label="Curve"
          valueLabel={
            densityCurve === "ease-in"
              ? "ease in"
              : densityCurve === "ease-out"
                ? "ease out"
                : densityCurve === "ease-in-out"
                  ? "ease in-out"
                  : "linear"
          }
        >
          {(
            [
              ["linear", "Linear"],
              ["ease-in", "Ease in"],
              ["ease-out", "Ease out"],
              ["ease-in-out", "Ease in-out"],
            ] as const
          ).map(([curve, label]) => (
            <ToolButton
              key={curve}
              active={densityCurve === curve}
              disabled={disabled}
              onClick={() => patch({ densityGradientCurve: curve })}
            >
              {label}
            </ToolButton>
          ))}
        </ToolGroup>
      </LayerCard>

      <LayerCard
        title="Reflection"
        description="Specular catch-light on the glass surface."
        enabled={reflectionEnabled}
        disabled={disabled}
        onToggle={(enabled) =>
          patch({
            reflectionEnabled: enabled,
            ...(enabled && (value?.reflectionStrength == null || value.reflectionStrength < 0.05)
              ? { reflectionStrength: DEFAULT_LENS_CLIP_RENDER.reflectionStrength }
              : {}),
          })
        }
      >
        <SliderRow
          label="Reflection opacity"
          value={reflectionOpacity}
          disabled={disabled}
          onChange={(pct) => patch({ reflectionOpacity: pct / 100 })}
        />
      </LayerCard>

      <LayerCard
        title="Edge"
        description="Rim thickness and darkness toward the lens edge."
        enabled={edgeEnabled}
        disabled={disabled}
        onToggle={(next) => patch({ edgeEnabled: next })}
      >
        <SliderRow
          label="Edge density"
          value={edgeDensity}
          disabled={disabled}
          onChange={(pct) => patch({ edgeDensity: pct / 100 })}
        />
        <SliderRow
          label="Edge opacity"
          value={edgeOpacity}
          disabled={disabled}
          onChange={(pct) => patch({ edgeOpacity: pct / 100, edgeDarkness: pct / 100 })}
        />
      </LayerCard>

      <div className="space-y-3 rounded border border-border/70 bg-background/50 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Transmission
        </p>
        <SliderRow
          label="Background visibility"
          value={backgroundVisibility}
          disabled={disabled}
          onChange={(pct) =>
            patch({
              backgroundVisibility: pct / 100,
              environmentTransparency: pct / 100,
            })
          }
        />
      </div>
    </div>
  );
}
