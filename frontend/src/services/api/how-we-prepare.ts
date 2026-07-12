import type { HowWePrepareOption } from "@bino-foundry/shared/types";

import { apiRequest } from "./client";

export const howWePrepareApi = {
  list(activeOnly = false) {
    const q = activeOnly ? "?active=true" : "";
    return apiRequest<HowWePrepareOption[]>(`/how-we-prepare-options${q}`);
  },

  create(payload: Omit<HowWePrepareOption, "id" | "createdAt" | "updatedAt">) {
    return apiRequest<HowWePrepareOption>("/how-we-prepare-options", { method: "POST", body: payload });
  },

  update(id: string, payload: Partial<Omit<HowWePrepareOption, "id" | "createdAt" | "updatedAt">>) {
    return apiRequest<HowWePrepareOption>(`/how-we-prepare-options/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  delete(id: string) {
    return apiRequest(`/how-we-prepare-options/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
