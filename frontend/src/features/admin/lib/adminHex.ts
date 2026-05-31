import type { CSSProperties } from "react";

import { buildCssTintBackground, normalizeTintRenderSpec } from "@/render/tint/lens-tint-spec";
import type { LensTintEntry } from "@/types/sunglasses-catalog";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHexInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("#")) return trimmed;
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  return trimmed;
}

export function validateHexFields(
  fields: { label: string; value: string }[],
): string | null {
  for (const { label, value } of fields) {
    if (!value.trim()) return `${label} is required`;
    if (!isValidHexColor(value)) return `${label} must be #RRGGBB (e.g. #2d3748)`;
  }
  return null;
}

/** CSS background matching compositor gradient stops and direction. */
export function tintPreviewStyle(entry: Pick<
  LensTintEntry,
  | "name"
  | "category"
  | "gradientTop"
  | "gradientBottom"
  | "opacity"
  | "gradientDirection"
  | "gradientAngle"
  | "gradientMidPosition"
  | "gradientIntensity"
>): CSSProperties {
  const spec = normalizeTintRenderSpec({
    name: entry.name || "Preview",
    top: isValidHexColor(entry.gradientTop) ? entry.gradientTop : "#888888",
    bottom: isValidHexColor(entry.gradientBottom) ? entry.gradientBottom : entry.gradientTop,
    category: entry.category,
    opacity: entry.opacity,
    gradientDirection: entry.gradientDirection,
    gradientAngle: entry.gradientAngle,
    gradientMidPosition: entry.gradientMidPosition,
    gradientIntensity: entry.gradientIntensity,
  });
  return {
    background: buildCssTintBackground(spec),
    opacity: Math.min(1, spec.opacity + 0.15),
  };
}
