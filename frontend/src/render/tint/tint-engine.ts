import { buildCssTintBackground, normalizeTintRenderSpec } from "./lens-tint-spec";
import type { TintGradient } from "../types";

/** Map visible-light transmission (0–100) to overlay opacity (prototype-style). */
export function vltToOpacity(vlt: number): number {
  return Math.max(0.15, Math.min(0.95, 1 - vlt / 100));
}

export function buildLensGradientStops(tint: TintGradient): { top: string; bottom: string } {
  const spec = normalizeTintRenderSpec({ name: tint.name, top: tint.top, bottom: tint.bottom, ...tint });
  return { top: spec.top, bottom: spec.bottom };
}

export function buildCssTintGradient(tint: TintGradient, gradientMode = true, opacity?: number): string {
  const spec = normalizeTintRenderSpec({
    name: tint.name,
    top: tint.top,
    bottom: tint.bottom,
    ...tint,
    opacity: opacity ?? tint.opacity,
  });
  if (!gradientMode) return spec.top;
  return buildCssTintBackground(spec);
}

export function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
