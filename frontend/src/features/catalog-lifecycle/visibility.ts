import type { CatalogAvailabilityStatus } from "@/types/catalog-availability";

/** Whether a catalogue item should appear in product builders (data-driven from status table). */
export function isCatalogItemVisibleInBuilder(
  availabilityStatusCode: string | undefined,
  isActive: boolean | undefined,
  statusByCode: Map<string, Pick<CatalogAvailabilityStatus, "showInBuilder">>,
): boolean {
  const code = availabilityStatusCode ?? (isActive === false ? "INACTIVE" : "ACTIVE");
  const status = statusByCode.get(code);
  if (status) return status.showInBuilder;
  return isActive !== false;
}
