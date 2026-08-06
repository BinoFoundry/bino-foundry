/**
 * Locale-invariant bead size display (always uses `.` as the decimal separator).
 * Prefer this over stored free-text labels that may contain commas (e.g. "2,5 mm").
 */

/** Format catalogue sizeMm for UI — e.g. 2.5 → "2.5 mm". */
export function formatBeadSizeMm(sizeMm: number, options?: { withUnit?: boolean }): string {
  if (!Number.isFinite(sizeMm)) return options?.withUnit === false ? "" : "—";
  // Trim trailing zeros but keep at least one fractional digit when present.
  const text = Number.isInteger(sizeMm)
    ? String(sizeMm)
    : String(Number(sizeMm.toFixed(4)));
  return options?.withUnit === false ? text : `${text} mm`;
}

/**
 * Display label for a size offer. Always derives from sizeMm so comma locales
 * in admin-entered labels cannot leak into the builder.
 */
export function displayBeadSizeLabel(sizeMm: number, _label?: string | null): string {
  return formatBeadSizeMm(sizeMm);
}

/** Parse admin numeric input that may use a comma decimal separator. */
export function parseLocaleNumber(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  return Number(normalized);
}
