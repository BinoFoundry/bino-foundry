import type { BeadCropConfig, BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";

import { apiRequest } from "./client";

export const beadsApi = {
  listTypes(): Promise<BeadTypeEntry[]> {
    return apiRequest<BeadTypeEntry[]>("/bead-types");
  },

  getType(id: string): Promise<BeadTypeEntry> {
    return apiRequest<BeadTypeEntry>(`/bead-types/${encodeURIComponent(id)}`);
  },

  createType(payload: Pick<BeadTypeEntry, "name" | "description"> & { displayOrder?: number }): Promise<BeadTypeEntry> {
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

  createLibrary(payload: BeadLibraryEntry): Promise<BeadLibraryEntry> {
    return apiRequest<BeadLibraryEntry>("/bead-libraries", {
      method: "POST",
      body: {
        id: payload.id,
        name: payload.name,
        price: payload.price,
        beadTypeId: payload.beadTypeId,
        description: payload.description,
        originalImage: payload.originalImage ?? payload.image,
        processedImage: payload.processedImage,
        image: payload.image,
        metadata: payload.metadata,
        cropConfig: payload.cropConfig,
        cropStatus: payload.cropStatus,
      },
    });
  },

  updateLibrary(publicId: string, payload: Partial<BeadLibraryEntry>): Promise<BeadLibraryEntry> {
    return apiRequest<BeadLibraryEntry>(`/bead-libraries/${encodeURIComponent(publicId)}`, {
      method: "PUT",
      body: {
        name: payload.name,
        price: payload.price,
        beadTypeId: payload.beadTypeId,
        description: payload.description,
        originalImage: payload.originalImage,
        processedImage: payload.processedImage,
        image: payload.image,
        metadata: payload.metadata,
        cropConfig: payload.cropConfig,
        cropStatus: payload.cropStatus,
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
};
