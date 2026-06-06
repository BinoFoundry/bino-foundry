import type { WristSizeEntry } from "@/types/wrist-sizes";

export function activeWristSizes(sizes: WristSizeEntry[]): WristSizeEntry[] {
  return sizes
    .filter((s) => s.isActive !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.sizeCm - b.sizeCm);
}

export function defaultWristSize(sizes: WristSizeEntry[]): WristSizeEntry | undefined {
  const active = activeWristSizes(sizes);
  return active.find((s) => s.isDefault) ?? active[0];
}

export function findWristSizeById(sizes: WristSizeEntry[], id: string): WristSizeEntry | undefined {
  return sizes.find((s) => s.id === id);
}

export function findWristSizeByCm(sizes: WristSizeEntry[], sizeCm: number): WristSizeEntry | undefined {
  return activeWristSizes(sizes).find((s) => s.sizeCm === sizeCm);
}

export function catalogueWristSizeBounds(sizes: WristSizeEntry[]): { minCm: number; maxCm: number } {
  const active = activeWristSizes(sizes);
  if (!active.length) return { minCm: 0, maxCm: 0 };
  const cms = active.map((s) => s.sizeCm);
  return { minCm: Math.min(...cms), maxCm: Math.max(...cms) };
}
