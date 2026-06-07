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
    const payload = {
      sizes: sizes.map((s) => ({
        sizeMm: Number(s.sizeMm),
        unitPrice: Number(s.unitPrice),
        isDefault: s.isDefault === true,
      })),
    };
    return apiRequest<BeadLibrarySizeOffer[]>(
      `/bead-library-sizes/library/${encodeURIComponent(libraryId)}`,
      {
        method: "PUT",
        body: payload,
      },
    );
  },
};
