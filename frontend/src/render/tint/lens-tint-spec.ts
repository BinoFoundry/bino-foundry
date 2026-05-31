import {
  DEFAULT_CLASSIC_LENS_TINT_RENDER,
  DEFAULT_LENS_TINT_RENDER,
  GRADIENT_DIRECTIONS,
  type GradientDirection,
  type LensTintCategory,
  type LensTintRenderFields,
} from "@bino-foundry/shared/types";

import type { LensTintEntry } from "@/types/sunglasses-catalog";
import type { TintGradient } from "../types";

export type { GradientDirection, LensTintCategory, LensTintRenderFields };

export interface SvgGradientStop {
  offset: string;
  stopColor: string;
  stopOpacity?: number;
}

export interface SvgLinearGradientVector {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  gradientUnits?: "objectBoundingBox" | "userSpaceOnUse";
  gradientTransform?: string;
}

export type NormalizedTintRenderSpec = Required<
  Pick<
    TintGradient,
    | "name"
    | "top"
    | "bottom"
    | "category"
    | "opacity"
    | "gradientDirection"
    | "gradientAngle"
    | "gradientMidPosition"
    | "gradientIntensity"
  >
>;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function isClassicTint(spec: Pick<TintGradient, "category" | "top" | "bottom">): boolean {
  if (spec.category === "classic") return true;
  return spec.top.trim().toLowerCase() === spec.bottom.trim().toLowerCase();
}

export function normalizeTintRenderSpec(
  input: Partial<TintGradient> & Pick<TintGradient, "name" | "top" | "bottom">,
): NormalizedTintRenderSpec {
  const category = input.category ?? (isClassicTint({ category: "gradient", ...input }) ? "classic" : "gradient");
  const defaults = category === "classic" ? DEFAULT_CLASSIC_LENS_TINT_RENDER : DEFAULT_LENS_TINT_RENDER;
  const top = input.top.trim();
  const bottom = category === "classic" ? top : input.bottom.trim();

  return {
    name: input.name,
    top,
    bottom,
    category,
    opacity: clamp(input.opacity ?? defaults.opacity, 0.05, 1),
    gradientDirection: GRADIENT_DIRECTIONS.includes(input.gradientDirection as GradientDirection)
      ? (input.gradientDirection as GradientDirection)
      : defaults.gradientDirection,
    gradientAngle: clamp(Math.round(input.gradientAngle ?? defaults.gradientAngle), 0, 359),
    gradientMidPosition: clamp(Math.round(input.gradientMidPosition ?? defaults.gradientMidPosition), 0, 100),
    gradientIntensity: clamp(input.gradientIntensity ?? defaults.gradientIntensity, 0, 1),
  };
}

export function lensTintEntryToRenderSpec(entry: LensTintEntry): NormalizedTintRenderSpec {
  return normalizeTintRenderSpec({
    name: entry.name,
    top: entry.gradientTop,
    bottom: entry.gradientBottom,
    category: entry.category,
    opacity: entry.opacity,
    gradientDirection: entry.gradientDirection,
    gradientAngle: entry.gradientAngle,
    gradientMidPosition: entry.gradientMidPosition,
    gradientIntensity: entry.gradientIntensity,
  });
}

export function lensTintEntryToGradient(entry: LensTintEntry): TintGradient {
  return lensTintEntryToRenderSpec(entry);
}

export function getLinearGradientVector(spec: Pick<TintGradient, "gradientDirection" | "gradientAngle">): SvgLinearGradientVector {
  if (spec.gradientDirection === "custom") {
    return {
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1",
      gradientUnits: "objectBoundingBox",
      gradientTransform: `rotate(${spec.gradientAngle ?? 180}, 0.5, 0.5)`,
    };
  }

  switch (spec.gradientDirection) {
    case "bottom-to-top":
      return { x1: "0%", y1: "100%", x2: "0%", y2: "0%" };
    case "left-to-right":
      return { x1: "0%", y1: "0%", x2: "100%", y2: "0%" };
    case "right-to-left":
      return { x1: "100%", y1: "0%", x2: "0%", y2: "0%" };
    case "top-to-bottom":
    default:
      return { x1: "0%", y1: "0%", x2: "0%", y2: "100%" };
  }
}

export function buildSvgGradientStops(spec: NormalizedTintRenderSpec): SvgGradientStop[] {
  if (isClassicTint(spec)) {
    return [
      { offset: "0%", stopColor: spec.top },
      { offset: "100%", stopColor: spec.top },
    ];
  }

  const mid = clamp(spec.gradientMidPosition, 8, 92);
  const spread = Math.round((1 - spec.gradientIntensity) * 18);
  const midLo = clamp(mid - spread, 0, 100);
  const midHi = clamp(mid + spread, 0, 100);
  const midOpacity = 0.72 + spec.gradientIntensity * 0.22;

  return [
    { offset: "0%", stopColor: spec.top, stopOpacity: 1 },
    { offset: `${midLo}%`, stopColor: spec.top, stopOpacity: midOpacity },
    { offset: `${midHi}%`, stopColor: spec.bottom, stopOpacity: 0.88 },
    { offset: "100%", stopColor: spec.bottom, stopOpacity: 1 },
  ];
}

/** CSS `linear-gradient` angle (0deg = upward, 90deg = rightward). */
export function cssGradientAngle(spec: Pick<TintGradient, "gradientDirection" | "gradientAngle">): number {
  switch (spec.gradientDirection) {
    case "top-to-bottom":
      return 180;
    case "bottom-to-top":
      return 0;
    case "left-to-right":
      return 90;
    case "right-to-left":
      return 270;
    case "custom":
      return spec.gradientAngle ?? 180;
    default:
      return 180;
  }
}

export function buildCssTintBackground(spec: NormalizedTintRenderSpec): string {
  if (isClassicTint(spec)) {
    return spec.top;
  }
  const angle = cssGradientAngle(spec);
  const stops = buildSvgGradientStops(spec);
  const parts = stops.map((s) => {
    const color =
      s.stopOpacity !== undefined && s.stopOpacity < 1
        ? hexToRgba(s.stopColor, s.stopOpacity)
        : s.stopColor;
    return `${color} ${s.offset}`;
  });
  return `linear-gradient(${angle}deg, ${parts.join(", ")})`;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Effective lens overlay opacity; frame clip settings can cap via multiplier. */
export function resolveTintLayerOpacity(
  spec: NormalizedTintRenderSpec,
  frameLensOpacity?: number,
): number {
  const tintOpacity = spec.opacity;
  if (frameLensOpacity === undefined) return tintOpacity;
  return Math.min(1, tintOpacity * (frameLensOpacity / DEFAULT_LENS_TINT_RENDER.opacity));
}

export function resolveHighlightStrength(spec: NormalizedTintRenderSpec, baseHighlight = 0.38): number {
  return clamp(baseHighlight * (1.05 - spec.opacity * 0.35), 0.18, 0.55);
}
