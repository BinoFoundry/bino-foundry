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

  recalculateMmGroupReferences(): Promise<{ groups: number; updated: number; skipped: number }> {
    return apiRequest<{ groups: number; updated: number; skipped: number }>(
      "/bead-sizes/recalculate-mm-group-references",
      { method: "POST", timeoutMs: 180_000 },
    );
  },

  listPendingNormalizedReexport(beadSizeId: string): Promise<
    {
      id: string;
      bead_library_id: string;
      bead_libraries: {
        public_id: string;
        name: string;
        crop_config: unknown;
        original_image_url: string | null;
      } | null;
    }[]
  > {
    return apiRequest(`/bead-sizes/${encodeURIComponent(beadSizeId)}/pending-normalized-reexport`);
  },
};
