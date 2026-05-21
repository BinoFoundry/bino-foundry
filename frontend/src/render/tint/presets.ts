import type { TintGradient } from "../types";

/** Presets ported from `customizer.html` tint buttons. */
export const TINT_PRESETS: TintGradient[] = [
  { name: "Classic Smoke", top: "#4a5568", bottom: "#2d3748" },
  { name: "Ocean Blue", top: "#2c5282", bottom: "#1a365d" },
  { name: "Sunset Fade", top: "#c05621", bottom: "#7b341e" },
  { name: "Solid Night", top: "#2d3748", bottom: "#2d3748" },
];

export const DEFAULT_TINT: TintGradient = TINT_PRESETS[0];

export function findTintPresetByName(name: string): TintGradient | undefined {
  const normalized = name.trim().toLowerCase();
  return TINT_PRESETS.find((p) => p.name.toLowerCase() === normalized);
}

export function guessTintFromLabel(label: string): TintGradient {
  const lower = label.toLowerCase();
  if (lower.includes("blue")) return TINT_PRESETS[1];
  if (lower.includes("sunset") || lower.includes("orange")) return TINT_PRESETS[2];
  if (lower.includes("night") || lower.includes("solid")) return TINT_PRESETS[3];
  if (lower.includes("smoke") || lower.includes("grey") || lower.includes("gray")) return TINT_PRESETS[0];
  return DEFAULT_TINT;
}
