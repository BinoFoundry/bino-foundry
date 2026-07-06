import type { BeadAvailabilityStatus } from "@/types/bead-availability";

import { apiRequest } from "./client";

export const beadAvailabilityStatusesApi = {
  list(): Promise<BeadAvailabilityStatus[]> {
    return apiRequest<BeadAvailabilityStatus[]>("/bead-availability-statuses");
  },
};
