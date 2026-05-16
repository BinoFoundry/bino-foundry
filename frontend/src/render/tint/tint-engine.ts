import type { TintGradient } from "../types";

/** Map visible-light transmission (0–100) to overlay opacity (prototype-style). */
export function vltToOpacity(vlt: number): number {
  return Math.max(0.15, Math.min(0.95, 1 - vlt / 100));
}

export function buildLensGradientStops(tint: TintGradient): { top: string; bottom: string } {
  return { top: tint.top, bottom: tint.bottom };
}

export function buildCssTintGradient(tint: TintGradient, gradientMode = true, opacity = 0.65): string {
  const { top, bottom } = buildLensGradientStops(tint);
  if (!gradientMode || top === bottom) {
    return top;
  }
  return `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
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
