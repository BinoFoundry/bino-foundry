import type { CatalogAvailabilityStatus } from "@/types/catalog-availability";

import { apiRequest } from "./client";

export const catalogAvailabilityStatusesApi = {
  list(): Promise<CatalogAvailabilityStatus[]> {
    return apiRequest<CatalogAvailabilityStatus[]>("/catalog-availability-statuses");
  },
};
