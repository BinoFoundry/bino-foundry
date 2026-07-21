import { describe, expect, it } from "vitest";

import {
  contactArcPxFromCapacityMm,
  contactArcPxFromSlotWidth,
  netContactLoopArcPx,
} from "./strand-contact-geometry.js";

describe("strand contact geometry", () => {
  it("maps catalogue sizeMm onto the wrist ring (capacity-consistent)", () => {
    const result = contactArcPxFromCapacityMm(
      8,
      160,
      1000,
      {
        contactWidth: 1,
        contactOffset: 0,
        spacingAdjustment: 0,
        leadingOverlap: 0,
        trailingOverlap: 0,
        collisionPadding: 0,
      },
      1,
    );
    expect(result.contactArcPx).toBeCloseTo(50, 5);
  });

  it("applies the same capacity formula for charm-like and crystal-like profiles", () => {
    const crystal = contactArcPxFromCapacityMm(8, 160, 1000, {
      contactWidth: 1,
      contactOffset: 0,
      spacingAdjustment: 0,
      leadingOverlap: 0,
      trailingOverlap: 0,
      collisionPadding: 0,
    });
    const charm = contactArcPxFromCapacityMm(8, 160, 1000, {
      contactWidth: 1,
      contactOffset: 0,
      spacingAdjustment: 0,
      leadingOverlap: 0.03,
      trailingOverlap: 0.03,
      collisionPadding: 0,
    });
    // Same sizeMm + neutral contact width → same occupied arc (no type branch).
    expect(charm.contactArcPx).toBeCloseTo(crystal.contactArcPx, 5);
  });

  it("computes contact arc from slot width only", () => {
    const result = contactArcPxFromSlotWidth(
      40,
      {
        contactWidth: 0.16,
        contactOffset: 0,
        spacingAdjustment: 0,
        leadingOverlap: 0.05,
        trailingOverlap: 0.05,
        collisionPadding: 0,
      },
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

  it("applies negative contact width and contactOffset to contact arc", () => {
    const base = contactArcPxFromSlotWidth(
      40,
      { contactWidth: 1, contactOffset: 0, spacingAdjustment: 0, leadingOverlap: 0, trailingOverlap: 0, collisionPadding: 0 },
      1,
    );
    const viaOffset = contactArcPxFromSlotWidth(
      40,
      { contactWidth: 1, contactOffset: -0.05, spacingAdjustment: 0, leadingOverlap: 0, trailingOverlap: 0, collisionPadding: 0 },
      1,
    );
    const viaWidth = contactArcPxFromSlotWidth(
      40,
      { contactWidth: 0.95, contactOffset: 0, spacingAdjustment: 0, leadingOverlap: 0, trailingOverlap: 0, collisionPadding: 0 },
      1,
    );
    expect(viaOffset.contactArcPx).toBeLessThan(base.contactArcPx);
    expect(viaWidth.contactArcPx).toBeCloseTo(viaOffset.contactArcPx, 5);
  });
});
