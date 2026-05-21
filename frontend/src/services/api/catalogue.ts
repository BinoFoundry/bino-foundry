import type {
  CharmEntry,
  CharmTypeEntry,
  CrystalEntry,
  FrameEntry,
  SpacerEntry,
  SpacerTypeEntry,
  TypeEntry,
} from "@/types/catalogue";

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

  listCharms(): Promise<CharmEntry[]> {
    return apiRequest<CharmEntry[]>("/charms");
  },

  getCharm(publicId: string): Promise<CharmEntry> {
    return apiRequest<CharmEntry>(`/charms/${encodeURIComponent(publicId)}`);
  },

  createCharm(payload: CharmEntry): Promise<CharmEntry> {
    return apiRequest<CharmEntry>("/charms", { method: "POST", body: payload });
  },

  updateCharm(publicId: string, payload: Partial<CharmEntry>): Promise<CharmEntry> {
    return apiRequest<CharmEntry>(`/charms/${encodeURIComponent(publicId)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteCharm(publicId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/charms/${encodeURIComponent(publicId)}`, {
      method: "DELETE",
    });
  },

  listSpacers(): Promise<SpacerEntry[]> {
    return apiRequest<SpacerEntry[]>("/spacers");
  },

  getSpacer(publicId: string): Promise<SpacerEntry> {
    return apiRequest<SpacerEntry>(`/spacers/${encodeURIComponent(publicId)}`);
  },

  createSpacer(payload: SpacerEntry): Promise<SpacerEntry> {
    return apiRequest<SpacerEntry>("/spacers", { method: "POST", body: payload });
  },

  updateSpacer(publicId: string, payload: Partial<SpacerEntry>): Promise<SpacerEntry> {
    return apiRequest<SpacerEntry>(`/spacers/${encodeURIComponent(publicId)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteSpacer(publicId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/spacers/${encodeURIComponent(publicId)}`, {
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

  listCharmTypes(): Promise<CharmTypeEntry[]> {
    return apiRequest<CharmTypeEntry[]>("/charm-types");
  },

  createCharmType(payload: Pick<CharmTypeEntry, "name" | "description">): Promise<CharmTypeEntry> {
    return apiRequest<CharmTypeEntry>("/charm-types", { method: "POST", body: payload });
  },

  updateCharmType(id: string, payload: Partial<CharmTypeEntry>): Promise<CharmTypeEntry> {
    return apiRequest<CharmTypeEntry>(`/charm-types/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteCharmType(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/charm-types/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  listSpacerTypes(): Promise<SpacerTypeEntry[]> {
    return apiRequest<SpacerTypeEntry[]>("/spacer-types");
  },

  createSpacerType(payload: Pick<SpacerTypeEntry, "name" | "description">): Promise<SpacerTypeEntry> {
    return apiRequest<SpacerTypeEntry>("/spacer-types", { method: "POST", body: payload });
  },

  updateSpacerType(id: string, payload: Partial<SpacerTypeEntry>): Promise<SpacerTypeEntry> {
    return apiRequest<SpacerTypeEntry>(`/spacer-types/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteSpacerType(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/spacer-types/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
