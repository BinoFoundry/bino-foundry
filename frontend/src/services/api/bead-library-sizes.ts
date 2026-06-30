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
    options?: { skipNormalization?: boolean },
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
        body: { sizes: payload.sizes, skipNormalization: options?.skipNormalization },
      },
    );
  },

  recalculateNormalization(libraryId: string): Promise<{ ok: boolean }> {
    return apiRequest<{ ok: boolean }>(
      `/bead-library-sizes/library/${encodeURIComponent(libraryId)}/recalculate-normalization`,
      { method: "POST" },
    );
  },

  saveNormalizedExports(
    libraryId: string,
    exports: {
      sizeMm: number;
      normalizedProcessedImageUrl: string;
      normalizedDeliveryUrls?: { png?: string; webp?: string; avif?: string } | null;
      normalizedVisibleDiameterPx: number;
    }[],
  ): Promise<BeadLibrarySizeOffer[]> {
    return apiRequest<BeadLibrarySizeOffer[]>(
      `/bead-library-sizes/library/${encodeURIComponent(libraryId)}/normalized-exports`,
      {
        method: "PUT",
        body: { exports },
      },
    );
  },
};
