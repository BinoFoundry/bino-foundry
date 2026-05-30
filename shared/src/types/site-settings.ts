export const SITE_SETTINGS_VERSION = 1 as const;

export interface SiteGeneralSettings {
  currencyCode: string;
}

export const DEFAULT_SITE_GENERAL_SETTINGS: SiteGeneralSettings = {
  currencyCode: "USD",
};
