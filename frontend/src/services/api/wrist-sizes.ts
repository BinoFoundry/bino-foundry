import type { WristSizeEntry } from "@/types/wrist-sizes";

import { apiRequest } from "./client";

export const wristSizesApi = {
  list(activeOnly = false) {
    const q = activeOnly ? "?active=true" : "";
    return apiRequest<WristSizeEntry[]>(`/wrist-sizes${q}`);
  },

  create(payload: Omit<WristSizeEntry, "id" | "createdAt" | "updatedAt">) {
    return apiRequest<WristSizeEntry>("/wrist-sizes", { method: "POST", body: payload });
  },

  update(id: string, payload: Partial<Omit<WristSizeEntry, "id" | "createdAt" | "updatedAt">>) {
    return apiRequest<WristSizeEntry>(`/wrist-sizes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  delete(id: string) {
    return apiRequest(`/wrist-sizes/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
