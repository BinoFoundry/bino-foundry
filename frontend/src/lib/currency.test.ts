import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatCurrencySurcharge,
  getCurrencySymbol,
} from "@bino-foundry/shared/currency";

describe("formatCurrency", () => {
  it("formats SGD with S$ prefix", () => {
    expect(formatCurrency(1250, "SGD")).toMatch(/S\$\s?1,250\.00/);
  });

  it("formats USD with $ prefix", () => {
    expect(formatCurrency(1250, "USD")).toBe("$1,250.00");
  });

  it("formats EUR with € prefix", () => {
    expect(formatCurrency(1250, "EUR")).toMatch(/€1,250\.00/);
  });

  it("formats IDR without decimal places", () => {
    expect(formatCurrency(1_250_000, "IDR")).toMatch(/Rp\s?1\.250\.000/);
  });

  it("prefixes surcharges with plus", () => {
    expect(formatCurrencySurcharge(12, "SGD")).toMatch(/^\+S\$/);
  });

  it("exposes currency symbols", () => {
    expect(getCurrencySymbol("GBP")).toBe("£");
    expect(getCurrencySymbol("AUD")).toMatch(/A\$/);
  });
});
