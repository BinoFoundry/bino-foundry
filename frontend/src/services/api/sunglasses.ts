import type {
  BuilderOptionEntry,
  LensTintEntry,
  SunglassesCatalogSnapshot,
} from "@/types/sunglasses-catalog";

import { apiRequest } from "./client";

export const sunglassesApi = {
  getCatalog(): Promise<SunglassesCatalogSnapshot> {
    return apiRequest<SunglassesCatalogSnapshot>("/sunglasses/catalog");
  },

  getAdminCatalog(): Promise<SunglassesCatalogSnapshot> {
    return apiRequest<SunglassesCatalogSnapshot>("/sunglasses/catalog/admin");
  },

  createLensTint(payload: Omit<LensTintEntry, "id" | "createdAt" | "updatedAt">): Promise<LensTintEntry> {
    return apiRequest<LensTintEntry>("/sunglasses/lens-tints", { method: "POST", body: payload });
  },

  updateLensTint(id: string, payload: Partial<LensTintEntry>): Promise<LensTintEntry> {
    return apiRequest<LensTintEntry>(`/sunglasses/lens-tints/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteLensTint(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/sunglasses/lens-tints/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  createBuilderOption(
    payload: Omit<BuilderOptionEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<BuilderOptionEntry> {
    return apiRequest<BuilderOptionEntry>("/sunglasses/options", { method: "POST", body: payload });
  },

  updateBuilderOption(id: string, payload: Partial<BuilderOptionEntry>): Promise<BuilderOptionEntry> {
    return apiRequest<BuilderOptionEntry>(`/sunglasses/options/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteBuilderOption(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/sunglasses/options/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
