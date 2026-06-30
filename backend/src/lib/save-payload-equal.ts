import type { BeadCropConfig } from "@bino-foundry/shared/types";

type SizeRow = { sizeMm: number; unitPrice: number; isDefault?: boolean };

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Compare crop configs ignoring volatile timestamps. */
export function cropConfigSemanticallyEqual(
  a: BeadCropConfig | null | undefined,
  b: BeadCropConfig | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const strip = (config: BeadCropConfig) => {
    const { updatedAt: _u, ...rest } = config as BeadCropConfig & { updatedAt?: number };
    return rest;
  };
  return stableJson(strip(a)) === stableJson(strip(b));
}

export function librarySizesSemanticallyEqual(
  a: SizeRow[] | null | undefined,
  b: SizeRow[] | null | undefined,
): boolean {
  const normalize = (rows: SizeRow[]) =>
    rows
      .map((row) => ({
        sizeMm: Number(row.sizeMm),
        unitPrice: Number(row.unitPrice),
        isDefault: row.isDefault === true,
      }))
      .sort((x, y) => x.sizeMm - y.sizeMm);

  const left = normalize(a ?? []);
  const right = normalize(b ?? []);
  if (left.length !== right.length) return false;
  return stableJson(left) === stableJson(right);
}

export function metadataSemanticallyEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
): boolean {
  return stableJson(a ?? {}) === stableJson(b ?? {});
}
