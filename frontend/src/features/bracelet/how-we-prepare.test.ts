import { describe, expect, it } from "vitest";

import {
  applyPreparationPricing,
  defaultPreparationSelection,
  resolvePreparationSelection,
} from "@bino-foundry/shared/how-we-prepare";
import type { HowWePrepareOption } from "@bino-foundry/shared/types";

function option(overrides: Partial<HowWePrepareOption> = {}): HowWePrepareOption {
  return {
    id: "1",
    name: "DIY Kit",
    slug: "diy-kit",
    shortDescription: "Kit",
    fullDescription: "",
    optionType: "preparation",
    priceType: "per_quantity",
    price: 11,
    defaultQuantity: 1,
    minimumQuantity: 1,
    maximumQuantity: 10,
    quantityEnabled: true,
    benefits: ["Elastic cord"],
    highlightTitle: "Made to string together",
    highlightDescription: "Instructions included",
    badge: null,
    status: "active",
    sortOrder: 20,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("applyPreparationPricing", () => {
  it("adds per_quantity preparation cost to bead subtotal", () => {
    const result = applyPreparationPricing({
      beadSubtotal: 100,
      twinning: false,
      options: [option()],
      selection: { optionSlug: "diy-kit", quantity: 2 },
    });

    expect(result.preparationSubtotal).toBe(22);
    expect(result.total).toBe(122);
    expect(result.preparationLineItem?.quantity).toBe(2);
  });

  it("charges per bracelet for ready-to-wear style options", () => {
    const result = applyPreparationPricing({
      beadSubtotal: 50,
      twinning: true,
      options: [
        option({
          slug: "ready-to-wear",
          priceType: "per_bracelet",
          price: 7,
          quantityEnabled: false,
        }),
      ],
      selection: { optionSlug: "ready-to-wear", quantity: 1 },
    });

    expect(result.preparationSubtotal).toBe(14);
    expect(result.total).toBe(64);
  });
});

describe("resolvePreparationSelection", () => {
  it("defaults to first active option", () => {
    const resolved = resolvePreparationSelection(
      [
        option({ slug: "ready-to-wear", sortOrder: 10, quantityEnabled: false }),
        option({ slug: "diy-kit", sortOrder: 20 }),
      ],
      null,
    );

    expect(resolved?.optionSlug).toBe("ready-to-wear");
    expect(resolved?.quantity).toBe(1);
  });
});

describe("defaultPreparationSelection", () => {
  it("returns null when no active options", () => {
    expect(defaultPreparationSelection([option({ status: "inactive" })])).toBeNull();
  });
});
