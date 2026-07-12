import type { BeadTagEntry } from "@/types/tags";

import { apiRequest } from "./client";

export const tagsApi = {
  list() {
    return apiRequest<BeadTagEntry[]>("/tags");
  },

  create(name: string) {
    return apiRequest<BeadTagEntry>("/tags", { method: "POST", body: { name } });
  },

  delete(id: string) {
    return apiRequest(`/tags/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
