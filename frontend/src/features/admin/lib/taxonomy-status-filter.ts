export type TaxonomyStatusFilter = "all" | "active" | "inactive";

export function filterByTaxonomyStatus<T extends { isActive?: boolean }>(
  items: T[],
  status: TaxonomyStatusFilter,
): T[] {
  if (status === "active") return items.filter((item) => item.isActive !== false);
  if (status === "inactive") return items.filter((item) => item.isActive === false);
  return items;
}
