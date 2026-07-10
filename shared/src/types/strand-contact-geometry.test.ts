import { describe, expect, it } from "vitest";

import {
  contactArcPxFromSlotWidth,
  netContactLoopArcPx,
} from "./strand-contact-geometry.js";

describe("strand contact geometry", () => {
  it("computes contact arc from slot width only", () => {
    const result = contactArcPxFromSlotWidth(
      40,
      { contactWidth: 0.16, leadingOverlap: 0.05, trailingOverlap: 0.05, collisionPadding: 0 },
      1,
    );
    expect(result.contactArcPx).toBeCloseTo(6.4, 5);
    expect(result.leadingOverlapPx).toBeCloseTo(2, 5);
    expect(result.trailingOverlapPx).toBeCloseTo(2, 5);
  });

  it("reduces net loop arc by junction overlaps", () => {
    const net = netContactLoopArcPx([40, 6.4, 40], [0, 2, 0], [0, 2, 0]);
    expect(net).toBeCloseTo(40 + 6.4 + 40 - 2 - 2, 5);
  });
});
