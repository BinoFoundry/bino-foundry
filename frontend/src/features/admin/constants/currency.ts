export const SITE_CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "AUD", "IDR"] as const;

export type SiteCurrencyCode = (typeof SITE_CURRENCY_OPTIONS)[number];
