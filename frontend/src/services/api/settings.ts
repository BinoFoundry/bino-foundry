import type { SiteGeneralSettings, StrandRenderProfile } from "@bino-foundry/shared/types";

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

  getStrandRenderDefaults(): Promise<StrandRenderProfile> {
    return apiRequest<StrandRenderProfile>("/settings/strand-render");
  },

  updateStrandRenderDefaults(settings: StrandRenderProfile): Promise<StrandRenderProfile> {
    return apiRequest<StrandRenderProfile>("/settings/strand-render", {
      method: "PUT",
      body: settings,
    });
  },
};
