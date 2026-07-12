import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { syncBeadRenderCalibrationFromSettings } from "@/render/bead-crop/sync-bead-render-calibration";
import { settingsApi } from "@/services/api/settings";

export const siteSettingsKeys = {
  general: () => ["site-settings", "general"] as const,
};

export function useSiteGeneralSettings() {
  const query = useQuery({
    queryKey: siteSettingsKeys.general(),
    queryFn: () => settingsApi.getGeneralSettings(),
    staleTime: 60_000,
    placeholderData: DEFAULT_SITE_GENERAL_SETTINGS,
  });

  useEffect(() => {
    if (query.data) {
      syncBeadRenderCalibrationFromSettings(query.data);
    }
  }, [query.data?.beadRenderCalibrationFactor]);

  return query;
}
