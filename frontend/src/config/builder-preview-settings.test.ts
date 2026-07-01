import { describe, expect, it } from "vitest";

import {
  BUILDER_PREVIEW_SETTINGS,
  formatPreviewFitCss,
  previewFitPercentForTier,
} from "./builder-preview-settings";
import { previewFitTierFromBreakpoint } from "../hooks/use-builder-preview-fit";

describe("builder-preview-settings", () => {
  it("exposes independent fit values per builder", () => {
    expect(BUILDER_PREVIEW_SETTINGS.sunglasses.desktop).toBe(82);
    expect(BUILDER_PREVIEW_SETTINGS.bracelet.desktop).toBeGreaterThan(
      BUILDER_PREVIEW_SETTINGS.sunglasses.desktop,
    );
  });

  it("formats CSS percentage strings", () => {
    expect(formatPreviewFitCss(82)).toBe("82%");
  });

  it("maps breakpoints to responsive tiers", () => {
    expect(previewFitTierFromBreakpoint("2xl")).toBe("desktop");
    expect(previewFitTierFromBreakpoint("xl")).toBe("largeLaptop");
    expect(previewFitTierFromBreakpoint("lg")).toBe("laptop");
    expect(previewFitTierFromBreakpoint("md")).toBe("tablet");
    expect(previewFitTierFromBreakpoint("sm")).toBe("mobile");
  });

  it("resolves tier percentages from settings", () => {
    expect(previewFitPercentForTier("sunglasses", "tablet")).toBe(90);
    expect(previewFitPercentForTier("bracelet", "tablet")).toBe(92);
  });
});
