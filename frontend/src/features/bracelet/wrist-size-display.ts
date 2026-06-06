/** Format a wrist size for display — supports whole and half-centimetre values. */
export function formatWristSizeCm(sizeCm: number): string {
  if (!Number.isFinite(sizeCm)) return "";
  if (Number.isInteger(sizeCm)) return String(sizeCm);
  const fixed = sizeCm.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
}

const CM_UNIT_PATTERN = /\s*(?:cm|centimetres?)\s*$/i;

/** True when the label only repeats the numeric size (e.g. "14 cm" for sizeCm 14). */
export function isDuplicateSizeLabel(label: string, sizeCm: number): boolean {
  const formatted = formatWristSizeCm(sizeCm);
  const norm = normalizeLabel(label);
  if (norm === formatted) return true;
  if (norm === `${formatted} cm` || norm === `${formatted}cm`) return true;
  if (norm === `${formatted} centimetre` || norm === `${formatted} centimetres`) return true;

  const withoutUnit = norm.replace(CM_UNIT_PATTERN, "").trim();
  return withoutUnit === formatted;
}

/**
 * Optional descriptor text when the admin label adds context beyond the cm value
 * (e.g. "Petite" from "Petite · 14 cm"). Returns null when label is redundant.
 */
export function wristSizeDescriptor(label: string, sizeCm: number): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (isDuplicateSizeLabel(trimmed, sizeCm)) return null;

  const formatted = formatWristSizeCm(sizeCm);
  const escaped = formatted.replace(".", "\\.");
  const sizePattern = new RegExp(
    `(?:^|[\\s·•|]+)${escaped}(?:\\s*(?:cm|centimetres?))?\\b|[\\s·•|]+${escaped}(?:\\s*(?:cm|centimetres?))?\\b$`,
    "gi",
  );
  const rest = trimmed
    .replace(sizePattern, "")
    .replace(/^[\s·•|]+|[\s·•|]+$/g, "")
    .trim();

  if (rest && !isDuplicateSizeLabel(rest, sizeCm)) return rest;
  return isDuplicateSizeLabel(trimmed, sizeCm) ? null : trimmed;
}
