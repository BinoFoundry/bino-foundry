import type { CreateBraceletConfigBody, SavedBraceletConfiguration } from "./bracelet.types";

import { apiRequest } from "./client";

export type { CreateBraceletConfigBody, SavedBraceletConfiguration };

export const braceletApi = {
  saveConfiguration(body: CreateBraceletConfigBody): Promise<SavedBraceletConfiguration> {
    return apiRequest<SavedBraceletConfiguration>("/bracelet/configurations", {
      method: "POST",
      body,
    });
  },

  getConfiguration(id: string): Promise<unknown> {
    return apiRequest(`/bracelet/configurations/${encodeURIComponent(id)}`);
  },
};
