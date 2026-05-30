import type { CSSProperties } from "react";

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

/** CSS background for classic (solid) or gradient tint preview. */
export function tintPreviewStyle(
  category: "classic" | "gradient",
  top: string,
  bottom: string,
): CSSProperties {
  if (category === "classic") {
    const c = isValidHexColor(top) ? top : "#888";
    return { background: c };
  }
  const t = isValidHexColor(top) ? top : "#888";
  const b = isValidHexColor(bottom) ? bottom : t;
  return { background: `linear-gradient(180deg, ${t} 0%, ${b} 100%)` };
}
