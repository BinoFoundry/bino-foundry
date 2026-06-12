/**
 * Platform currency definitions and formatting.
 * Display currency only — no exchange-rate conversion.
 */

export interface CurrencyDefinition {
  code: string;
  name: string;
  /** BCP 47 locale for Intl.NumberFormat conventions. */
  locale: string;
  /** Overrides Intl symbol when platform display differs (e.g. SGD → S$). */
  displaySymbol?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/** Extend this list to add currencies without touching UI components. */
export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: "SGD", name: "Singapore Dollar", locale: "en-SG", displaySymbol: "S$" },
  { code: "USD", name: "US Dollar", locale: "en-US" },
  { code: "EUR", name: "Euro", locale: "en-IE" },
  { code: "GBP", name: "British Pound", locale: "en-GB" },
  { code: "AUD", name: "Australian Dollar", locale: "en-AU", displaySymbol: "A$" },
  {
    code: "IDR",
    name: "Indonesian Rupiah",
    locale: "id-ID",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
] as const;

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code) as [
  string,
  ...string[],
];

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

const currencyByCode = new Map(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyDefinition(currencyCode: string): CurrencyDefinition | undefined {
  return currencyByCode.get(currencyCode.toUpperCase());
}

export function getCurrencyLabel(currencyCode: string): string {
  const def = getCurrencyDefinition(currencyCode);
  return def ? `${def.code} — ${def.name}` : currencyCode.toUpperCase();
}

export function isSupportedCurrencyCode(code: string): boolean {
  return currencyByCode.has(code.toUpperCase());
}

function resolveFormatOptions(currencyCode: string): {
  locale: string;
  displaySymbol?: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
} {
  const code = currencyCode.toUpperCase();
  const def = getCurrencyDefinition(code);
  return {
    locale: def?.locale ?? "en-US",
    displaySymbol: def?.displaySymbol,
    minimumFractionDigits: def?.minimumFractionDigits ?? 2,
    maximumFractionDigits: def?.maximumFractionDigits ?? 2,
  };
}

function formatWithIntl(
  amount: number,
  code: string,
  locale: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  displaySymbol?: string,
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits,
    maximumFractionDigits,
  });

  if (!displaySymbol) {
    return formatter.format(amount);
  }

  return formatter
    .formatToParts(amount)
    .map((part) => (part.type === "currency" ? displaySymbol : part.value))
    .join("");
}

/** Format a monetary amount using the selected currency's conventions. */
export function formatCurrency(amount: number, currencyCode: string): string {
  const code = currencyCode.toUpperCase();
  const { locale, displaySymbol, minimumFractionDigits, maximumFractionDigits } =
    resolveFormatOptions(code);

  if (!Number.isFinite(amount)) return "—";

  try {
    return formatWithIntl(
      amount,
      code,
      locale,
      minimumFractionDigits,
      maximumFractionDigits,
      displaySymbol,
    );
  } catch {
    return `${displaySymbol ?? code} ${amount.toFixed(maximumFractionDigits)}`;
  }
}

/** Prefix a positive surcharge amount, e.g. "+S$12.00". */
export function formatCurrencySurcharge(amount: number, currencyCode: string): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `+${formatCurrency(amount, currencyCode)}`;
}

/** Format a min–max price range in the same currency. */
export function formatCurrencyRange(
  min: number,
  max: number,
  currencyCode: string,
): string {
  if (min === max) return formatCurrency(min, currencyCode);
  return `${formatCurrency(min, currencyCode)}–${formatCurrency(max, currencyCode)}`;
}

/** Symbol or currency code for accessibility labels (e.g. "S$", "€"). */
export function getCurrencySymbol(currencyCode: string): string {
  const code = currencyCode.toUpperCase();
  const { locale, displaySymbol, minimumFractionDigits, maximumFractionDigits } =
    resolveFormatOptions(code);

  if (displaySymbol) return displaySymbol;

  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits,
      maximumFractionDigits,
    }).formatToParts(0);
    const symbol = parts.find((p) => p.type === "currency")?.value;
    return symbol?.trim() || code;
  } catch {
    return code;
  }
}
