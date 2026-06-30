import type { BeadCropConfig, BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";

import { apiRequest } from "./client";

export const beadsApi = {
  listTypes(): Promise<BeadTypeEntry[]> {
    return apiRequest<BeadTypeEntry[]>("/bead-types");
  },

  getType(id: string): Promise<BeadTypeEntry> {
    return apiRequest<BeadTypeEntry>(`/bead-types/${encodeURIComponent(id)}`);
  },

  createType(
    payload: Pick<BeadTypeEntry, "name" | "description"> & {
      displayOrder?: number;
      isActive?: boolean;
      metadata?: BeadTypeEntry["metadata"];
    },
  ): Promise<BeadTypeEntry> {
    return apiRequest<BeadTypeEntry>("/bead-types", { method: "POST", body: payload });
  },

  updateType(id: string, payload: Partial<BeadTypeEntry>): Promise<BeadTypeEntry> {
    return apiRequest<BeadTypeEntry>(`/bead-types/${encodeURIComponent(id)}`, { method: "PUT", body: payload });
  },

  deleteType(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/bead-types/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  listLibraries(): Promise<BeadLibraryEntry[]> {
    return apiRequest<BeadLibraryEntry[]>("/bead-libraries");
  },

  getLibrary(publicId: string): Promise<BeadLibraryEntry> {
    return apiRequest<BeadLibraryEntry>(`/bead-libraries/${encodeURIComponent(publicId)}`);
  },

  createLibrary(payload: BeadLibraryEntry, sizes: BeadLibrarySizeInput[]): Promise<BeadLibraryEntry> {
    return apiRequest<BeadLibraryEntry>("/bead-libraries", {
      method: "POST",
      body: {
        id: payload.id,
        name: payload.name,
        sizes,
        beadTypeId: payload.beadTypeId,
        description: payload.description,
        originalImage: payload.originalImage ?? payload.image,
        processedImage: payload.processedImage,
        image: payload.image,
        metadata: payload.metadata,
        cropConfig: payload.cropConfig,
        cropStatus: payload.cropStatus,
        isActive: payload.isActive,
        displayOrder: payload.displayOrder,
      },
    });
  },

  saveLibraryComplete(
    publicId: string,
    payload: {
      library: Partial<BeadLibraryEntry>;
      sizes?: BeadLibrarySizeInput[];
    },
  ): Promise<{
    library: BeadLibraryEntry;
    sizes: import("@/types/bead-library-sizes").BeadLibrarySizeOffer[] | null;
    sizesChanged: boolean;
    cropChanged: boolean;
  }> {
    return apiRequest(`/bead-libraries/${encodeURIComponent(publicId)}/save`, {
      method: "PUT",
      body: payload,
    });
  },

  updateLibrary(publicId: string, payload: Partial<BeadLibraryEntry>): Promise<BeadLibraryEntry> {
    const originalImage =
      payload.originalImage?.trim() ||
      (payload.image && !payload.processedImage ? payload.image : undefined);

    return apiRequest<BeadLibraryEntry>(`/bead-libraries/${encodeURIComponent(publicId)}`, {
      method: "PUT",
      body: {
        name: payload.name,
        beadTypeId: payload.beadTypeId,
        description: payload.description,
        originalImage,
        processedImage: payload.processedImage,
        metadata: payload.metadata,
        cropConfig: payload.cropConfig,
        cropStatus: payload.cropStatus,
        isActive: payload.isActive,
        displayOrder: payload.displayOrder,
      },
    });
  },

  updateCrop(
    publicId: string,
    payload: { cropConfig: BeadCropConfig; cropStatus?: BeadLibraryEntry["cropStatus"]; processedImage?: string },
  ): Promise<BeadLibraryEntry> {
    return apiRequest<BeadLibraryEntry>(`/bead-libraries/${encodeURIComponent(publicId)}/crop`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteLibrary(publicId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/bead-libraries/${encodeURIComponent(publicId)}`, {
      method: "DELETE",
    });
  },

  recalculateBoundsMetadata(): Promise<{ updated: number; skipped: number }> {
    return apiRequest<{ updated: number; skipped: number }>(
      "/bead-libraries/recalculate-bounds-metadata",
      { method: "POST" },
    );
  },
};
