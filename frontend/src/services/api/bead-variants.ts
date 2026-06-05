import type { BeadVariantEntry } from "@/types/bead-variants";

import { apiRequest } from "./client";

export const beadVariantsApi = {
  list(activeOnly = true, libraryId?: string): Promise<BeadVariantEntry[]> {
    const params = new URLSearchParams();
    if (activeOnly) params.set("active", "1");
    if (libraryId) params.set("libraryId", libraryId);
    const q = params.toString();
    return apiRequest<BeadVariantEntry[]>(`/bead-variants${q ? `?${q}` : ""}`);
  },

  get(id: string): Promise<BeadVariantEntry> {
    return apiRequest<BeadVariantEntry>(`/bead-variants/${encodeURIComponent(id)}`);
  },

  create(
    payload: Omit<BeadVariantEntry, "id" | "createdAt" | "updatedAt"> & { publicId: string },
  ): Promise<BeadVariantEntry> {
    return apiRequest<BeadVariantEntry>("/bead-variants", {
      method: "POST",
      body: {
        publicId: payload.publicId,
        beadLibraryId: payload.beadLibraryId,
        sizeMm: payload.sizeMm,
        unitPrice: payload.unitPrice,
        label: payload.label,
        displayOrder: payload.displayOrder,
        isActive: payload.isActive,
        isDefault: payload.isDefault,
      },
    });
  },

  update(id: string, payload: Partial<BeadVariantEntry>): Promise<BeadVariantEntry> {
    return apiRequest<BeadVariantEntry>(`/bead-variants/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/bead-variants/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
