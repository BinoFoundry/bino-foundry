import type { BeadSizeEntry } from "@/types/bead-sizes";

import { apiRequest } from "./client";

export const beadSizesApi = {
  list(activeOnly = false): Promise<BeadSizeEntry[]> {
    const q = activeOnly ? "?active=1" : "";
    return apiRequest<BeadSizeEntry[]>(`/bead-sizes${q}`);
  },

  create(payload: Omit<BeadSizeEntry, "id" | "createdAt" | "updatedAt">): Promise<BeadSizeEntry> {
    return apiRequest<BeadSizeEntry>("/bead-sizes", { method: "POST", body: payload });
  },

  update(id: string, payload: Partial<BeadSizeEntry>): Promise<BeadSizeEntry> {
    return apiRequest<BeadSizeEntry>(`/bead-sizes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiRequest(`/bead-sizes/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
