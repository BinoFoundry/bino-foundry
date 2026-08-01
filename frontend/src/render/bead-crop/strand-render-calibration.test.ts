import { describe, expect, it } from "vitest";

import { strandLayoutShellDimensions } from "@/features/bracelet/strand-path";
import { scaleBeadSlotSizingForRenderScale } from "@/render/bead-crop/strand-bead";
import { layoutDiameterPxForMm } from "@/render/bead-crop/canonical-strand-mm-scale";

describe("visual-only hierarchical render calibration", () => {
  it("applies resolvedRenderScale to round inline shells", () => {
    const slot = { width: 40, height: 40 };
    const scaled = strandLayoutShellDimensions(slot, {
      visualScale: 0.9,
      forceRoundFootprint: true,
      attachmentStyle: "inline",
    });
    expect(scaled.width).toBeCloseTo(36, 5);
    expect(scaled.height).toBeCloseTo(36, 5);
  });

  it("scales image layout with render scale without changing mm layout diameter", () => {
    const mmSlot = layoutDiameterPxForMm(8, 1);
    const sizing = {
      imageDimensions: { width: 30, height: 30 },
      imageOffsetPx: { left: 5, top: 5 },
    };
    const scaled = scaleBeadSlotSizingForRenderScale(sizing, 0.9);
    expect(scaled.imageDimensions.width).toBeCloseTo(27, 5);
    expect(scaled.imageOffsetPx.left).toBeCloseTo(4.5, 5);
    // Physical mm→px curve is unchanged by hierarchical visual scale.
    expect(layoutDiameterPxForMm(8, 1)).toBeCloseTo(mmSlot, 8);
  });
});
