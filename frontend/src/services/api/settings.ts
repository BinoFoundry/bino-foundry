import type { SiteGeneralSettings } from "@bino-foundry/shared/types";

import { apiRequest } from "./client";

export const settingsApi = {
  getGeneralSettings(): Promise<SiteGeneralSettings> {
    return apiRequest<SiteGeneralSettings>("/settings/general");
  },

  updateGeneralSettings(settings: SiteGeneralSettings): Promise<SiteGeneralSettings> {
    return apiRequest<SiteGeneralSettings>("/settings/general", {
      method: "PUT",
      body: settings,
    });
  },
};
