import { useQuery } from "@tanstack/react-query";

import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { settingsApi } from "@/services/api/settings";

export const siteSettingsKeys = {
  general: () => ["site-settings", "general"] as const,
};

export function useSiteGeneralSettings() {
  return useQuery({
    queryKey: siteSettingsKeys.general(),
    queryFn: () => settingsApi.getGeneralSettings(),
    staleTime: 60_000,
    placeholderData: DEFAULT_SITE_GENERAL_SETTINGS,
  });
}
