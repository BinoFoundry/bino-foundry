import type { CrystalEntry } from "@/types/catalogue";
import type { FrameEntry } from "@/types/catalogue";
import type { TypeEntry } from "@/types/catalogue";

import { apiRequest } from "./client";

export const catalogueApi = {
  listCrystals(): Promise<CrystalEntry[]> {
    return apiRequest<CrystalEntry[]>("/crystals");
  },

  getCrystal(publicId: string): Promise<CrystalEntry> {
    return apiRequest<CrystalEntry>(`/crystals/${encodeURIComponent(publicId)}`);
  },

  createCrystal(payload: CrystalEntry): Promise<CrystalEntry> {
    return apiRequest<CrystalEntry>("/crystals", { method: "POST", body: payload });
  },

  updateCrystal(publicId: string, payload: Partial<CrystalEntry>): Promise<CrystalEntry> {
    return apiRequest<CrystalEntry>(`/crystals/${encodeURIComponent(publicId)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteCrystal(publicId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/crystals/${encodeURIComponent(publicId)}`, {
      method: "DELETE",
    });
  },

  listFrames(): Promise<FrameEntry[]> {
    return apiRequest<FrameEntry[]>("/frames");
  },

  getFrame(id: string): Promise<FrameEntry> {
    return apiRequest<FrameEntry>(`/frames/${encodeURIComponent(id)}`);
  },

  createFrame(payload: Omit<FrameEntry, "id"> & { id?: string }): Promise<FrameEntry> {
    return apiRequest<FrameEntry>("/frames", { method: "POST", body: payload });
  },

  updateFrame(id: string, payload: Partial<FrameEntry>): Promise<FrameEntry> {
    return apiRequest<FrameEntry>(`/frames/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteFrame(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/frames/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  listTypes(): Promise<TypeEntry[]> {
    return apiRequest<TypeEntry[]>("/types");
  },

  getType(id: string): Promise<TypeEntry> {
    return apiRequest<TypeEntry>(`/types/${encodeURIComponent(id)}`);
  },

  createType(payload: Pick<TypeEntry, "name" | "description">): Promise<TypeEntry> {
    return apiRequest<TypeEntry>("/types", { method: "POST", body: payload });
  },

  updateType(id: string, payload: Partial<TypeEntry>): Promise<TypeEntry> {
    return apiRequest<TypeEntry>(`/types/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteType(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/types/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
