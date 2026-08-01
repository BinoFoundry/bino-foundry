/**
 * Deterministic JSON for dirty comparisons. Sorts object keys; drops `undefined`.
 */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v !== undefined) out[key] = sortValue(v);
  }
  return out;
}

export function snapshotsEqual(a: unknown, b: unknown): boolean {
  return stableSerialize(a) === stableSerialize(b);
}
