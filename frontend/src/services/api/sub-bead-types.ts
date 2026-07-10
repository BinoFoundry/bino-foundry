import type { SubBeadTypeEntry } from "@/types/beads";

import { apiRequest } from "./client";

export const subBeadTypesApi = {
  list(beadTypeId?: string): Promise<SubBeadTypeEntry[]> {
    const query = beadTypeId ? `?beadTypeId=${encodeURIComponent(beadTypeId)}` : "";
    return apiRequest<SubBeadTypeEntry[]>(`/sub-bead-types${query}`);
  },

  get(id: string): Promise<SubBeadTypeEntry> {
    return apiRequest<SubBeadTypeEntry>(`/sub-bead-types/${encodeURIComponent(id)}`);
  },

  create(
    payload: Pick<SubBeadTypeEntry, "beadTypeId" | "name" | "description"> & {
      displayOrder?: number;
      isActive?: boolean;
      metadata?: SubBeadTypeEntry["metadata"];
    },
  ): Promise<SubBeadTypeEntry> {
    return apiRequest<SubBeadTypeEntry>("/sub-bead-types", { method: "POST", body: payload });
  },

  update(id: string, payload: Partial<SubBeadTypeEntry>): Promise<SubBeadTypeEntry> {
    return apiRequest<SubBeadTypeEntry>(`/sub-bead-types/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/sub-bead-types/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
