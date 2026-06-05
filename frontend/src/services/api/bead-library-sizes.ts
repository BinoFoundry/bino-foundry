import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import { apiRequest } from "./client";

export const beadLibrarySizesApi = {
  list(libraryId?: string): Promise<BeadLibrarySizeOffer[]> {
    const q = libraryId ? `libraryId=${encodeURIComponent(libraryId)}` : "";
    return apiRequest<BeadLibrarySizeOffer[]>(`/bead-library-sizes${q ? `?${q}` : ""}`);
  },

  sync(
    libraryId: string,
    sizes: { sizeMm: number; unitPrice: number; isDefault?: boolean }[],
  ): Promise<BeadLibrarySizeOffer[]> {
    return apiRequest<BeadLibrarySizeOffer[]>(
      `/bead-library-sizes/library/${encodeURIComponent(libraryId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ sizes }),
      },
    );
  },

  suggestPrices(libraryId: string, sizeMm: number[]): Promise<Record<string, number>> {
    const q = sizeMm.map((m) => `sizeMm=${m}`).join("&");
    return apiRequest<Record<string, number>>(
      `/bead-library-sizes/suggest/${encodeURIComponent(libraryId)}?${q}`,
    );
  },
};
