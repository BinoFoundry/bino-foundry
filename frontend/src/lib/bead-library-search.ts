import type { BeadLibraryEntry } from "@/types/beads";

/** Sentinel value for the "All" sub-type tab. */
export const SUB_BEAD_TYPE_ALL = "__all__" as const;

export type SubBeadTypeTabValue = typeof SUB_BEAD_TYPE_ALL | string;

export function beadMatchesLibrarySearch(bead: BeadLibraryEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (bead.name.toLowerCase().includes(q)) return true;

  const sku = (bead as BeadLibraryEntry & { sku?: string }).sku;
  if (sku?.toLowerCase().includes(q)) return true;

  for (const tag of bead.tags ?? []) {
    if (tag.name.toLowerCase().includes(q) || tag.slug.toLowerCase().includes(q)) return true;
  }

  return false;
}

export function buildBeadSearchIndex(beads: BeadLibraryEntry[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const bead of beads) {
    const parts = [bead.name];
    const sku = (bead as BeadLibraryEntry & { sku?: string }).sku;
    if (sku) parts.push(sku);
    for (const tag of bead.tags ?? []) {
      parts.push(tag.name, tag.slug);
    }
    index.set(bead.id, parts.join(" ").toLowerCase());
  }
  return index;
}

export function beadMatchesSearchIndex(index: Map<string, string>, beadId: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = index.get(beadId);
  if (!haystack) return false;
  return haystack.includes(q);
}
