export const SITE_SETTINGS_VERSION = 1 as const;

export interface SiteGeneralSettings {
  currencyCode: string;
  /** Left sidebar title in the bracelet builder (admin-configurable). */
  braceletBuilderLibraryTitle: string;
}

export const DEFAULT_SITE_GENERAL_SETTINGS: SiteGeneralSettings = {
  currencyCode: "SGD",
  braceletBuilderLibraryTitle: "Bead collection",
};
