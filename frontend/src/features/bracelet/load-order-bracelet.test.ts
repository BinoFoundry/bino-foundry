import { describe, expect, it } from "vitest";

import type { OrderSnapshotBracelet } from "@bino-foundry/shared/types";
import { DEFAULT_STRAND_RENDER_PROFILE } from "@bino-foundry/shared/types";

import {
  buildPlacedFromOrderBracelet,
  orderBraceletHasFrozenRender,
} from "./load-order-bracelet";

describe("buildPlacedFromOrderBracelet", () => {
  const frozenBracelet: OrderSnapshotBracelet = {
    twinning: true,
    wristSizeCmA: 16,
    wristSizeCmB: 17,
    beadSubtotal: 10,
    preparationSubtotal: 0,
    preparation: null,
    items: [
      {
        strandIndex: 0,
        slotPosition: 0,
        beadLibraryId: "bead_a",
        beadName: "Amethyst",
        beadSizeMm: 8,
        sizeLabel: "8 mm",
        unitPrice: 5,
        render: {
          image: "https://example.com/a.webp",
          beadTypeSlug: "crystal",
          strandRenderProfile: {
            ...DEFAULT_STRAND_RENDER_PROFILE,
            hangOffset: 0.2,
          },
        },
      },
      {
        strandIndex: 1,
        slotPosition: 0,
        beadLibraryId: "bead_b",
        beadName: "Charm",
        beadSizeMm: 10,
        sizeLabel: "10 mm",
        unitPrice: 5,
        render: {
          image: "https://example.com/b.webp",
          beadTypeSlug: "charm",
          strandRenderProfile: {
            ...DEFAULT_STRAND_RENDER_PROFILE,
            hangOffset: 0.4,
          },
        },
      },
    ],
  };

  it("detects frozen render payloads", () => {
    expect(orderBraceletHasFrozenRender(frozenBracelet)).toBe(true);
  });

  it("hydrates both matching-pair strands from frozen render without catalogue", () => {
    const result = buildPlacedFromOrderBracelet(frozenBracelet);
    expect(result.usedFrozenRender).toBe(true);
    expect(result.placedBeadsA).toHaveLength(1);
    expect(result.placedBeadsB).toHaveLength(1);
    expect(result.placedBeadsA[0]?.bead.image).toBe("https://example.com/a.webp");
    expect(result.placedBeadsB[0]?.bead.metadata?.frozenStrandRenderProfile).toMatchObject({
      hangOffset: 0.4,
    });
    expect(result.wristSizeCmA).toBe(16);
    expect(result.wristSizeCmB).toBe(17);
  });
});
