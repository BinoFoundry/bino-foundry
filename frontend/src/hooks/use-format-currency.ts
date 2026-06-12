import { useMemo } from "react";
import {
  DEFAULT_SITE_GENERAL_SETTINGS,
  type SiteGeneralSettings,
} from "@bino-foundry/shared/types";
import {
  formatCurrency,
  formatCurrencyRange,
  formatCurrencySurcharge,
  getCurrencyLabel,
  getCurrencySymbol,
} from "@bino-foundry/shared/currency";

import { useSiteGeneralSettings } from "./use-site-settings";

export interface CurrencyFormatter {
  currencyCode: string;
  format: (amount: number) => string;
  formatSurcharge: (amount: number) => string;
  formatRange: (min: number, max: number) => string;
  symbol: string;
  label: string;
}

function buildFormatter(currencyCode: string): CurrencyFormatter {
  const code = currencyCode.toUpperCase();
  return {
    currencyCode: code,
    format: (amount) => formatCurrency(amount, code),
    formatSurcharge: (amount) => formatCurrencySurcharge(amount, code),
    formatRange: (min, max) => formatCurrencyRange(min, max, code),
    symbol: getCurrencySymbol(code),
    label: getCurrencyLabel(code),
  };
}

/** Active site currency from General Settings. */
export function useFormatCurrency(): CurrencyFormatter {
  const { data } = useSiteGeneralSettings();
  const code = data?.currencyCode ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode;
  return useMemo(() => buildFormatter(code), [code]);
}

/** Format using a specific currency code (e.g. saved design / order snapshot). */
export function useFormatCurrencyFor(currencyCode: string): CurrencyFormatter {
  return useMemo(() => buildFormatter(currencyCode), [currencyCode]);
}

export function formatCurrencyFromSettings(
  amount: number,
  settings?: SiteGeneralSettings | null,
): string {
  const code = settings?.currencyCode ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode;
  return formatCurrency(amount, code);
}
