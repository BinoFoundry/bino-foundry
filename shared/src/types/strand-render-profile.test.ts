import { describe, expect, it } from "vitest";

import {
  effectiveStrandContactWidth,
  contactWidthStoredToTuningDelta,
  mergeStrandRenderProfile,
  STRAND_CONTACT_SPACING_MAX,
  STRAND_CONTACT_SPACING_MIN,
  strandContactSpacingMin,
} from "./strand-render-profile.js";

describe("strandContactSpacingMin", () => {
  it("mirrors the configured maximum", () => {
    expect(strandContactSpacingMin(2)).toBe(-2);
    expect(strandContactSpacingMin(1)).toBe(-1);
    expect(strandContactSpacingMin(5)).toBe(-5);
    expect(strandContactSpacingMin()).toBe(STRAND_CONTACT_SPACING_MIN);
  });
});

describe("contactWidthStoredToTuningDelta", () => {
  it("maps legacy neutral occupancy 1 to zero delta", () => {
    expect(contactWidthStoredToTuningDelta(1)).toBe(0);
  });

  it("maps admin neutral 0 to zero delta", () => {
    expect(contactWidthStoredToTuningDelta(0)).toBe(0);
  });

  it("maps legacy fractional occupancy to delta from 1", () => {
    expect(contactWidthStoredToTuningDelta(0.08)).toBeCloseTo(-0.92, 5);
    expect(contactWidthStoredToTuningDelta(0.95)).toBeCloseTo(-0.05, 5);
  });

  it("passes symmetrical admin tuning through", () => {
    expect(contactWidthStoredToTuningDelta(-0.2)).toBe(-0.2);
    expect(contactWidthStoredToTuningDelta(-2)).toBe(-2);
  });
});

describe("effectiveStrandContactWidth", () => {
  it("keeps legacy neutral occupancy at multiplier 1", () => {
    expect(
      effectiveStrandContactWidth({
        contactWidth: 1,
        contactOffset: 0,
        spacingAdjustment: 0,
      }),
    ).toBe(1);
  });

  it("treats admin contact width 0 as neutral natural touch", () => {
    expect(
      effectiveStrandContactWidth({
        contactWidth: 0,
        contactOffset: 0,
        spacingAdjustment: 0,
      }),
    ).toBe(1);
  });

  it("applies contact adjustment on top of neutral occupancy", () => {
    expect(
      effectiveStrandContactWidth({
        contactWidth: 1,
        contactOffset: -0.05,
        spacingAdjustment: 0,
      }),
    ).toBeCloseTo(0.95, 5);
  });

  it("applies admin tuning deltas directly", () => {
    expect(
      effectiveStrandContactWidth({
        contactWidth: -0.2,
        contactOffset: 0,
        spacingAdjustment: 0,
      }),
    ).toBeCloseTo(0.8, 5);
  });

  it("distinguishes neutral 0 from strong negative tuning", () => {
    const neutral = effectiveStrandContactWidth({
      contactWidth: 0,
      contactOffset: 0,
      spacingAdjustment: 0,
    });
    const tightened = effectiveStrandContactWidth({
      contactWidth: -0.2,
      contactOffset: 0,
      spacingAdjustment: 0,
    });
    expect(neutral).toBeGreaterThan(tightened);
  });

  it("clamps extreme negative sums to zero", () => {
    expect(
      effectiveStrandContactWidth({
        contactWidth: -2,
        contactOffset: -2,
        spacingAdjustment: -2,
      }),
    ).toBe(0);
  });

  it("caps positive sums at spacing maximum", () => {
    expect(
      effectiveStrandContactWidth({
        contactWidth: 2,
        contactOffset: 1,
        spacingAdjustment: 1,
      }),
    ).toBe(STRAND_CONTACT_SPACING_MAX);
  });
});

describe("mergeStrandRenderProfile contact clamps", () => {
  it("accepts negative contact width within symmetrical range", () => {
    const merged = mergeStrandRenderProfile({ contactWidth: -1.2 });
    expect(merged.contactWidth).toBeCloseTo(-1.2, 5);
  });

  it("clamps contact width to configured symmetrical bounds", () => {
    const merged = mergeStrandRenderProfile({ contactWidth: -2.5 });
    expect(merged.contactWidth).toBe(STRAND_CONTACT_SPACING_MIN);
  });

  it("clamps contact adjustment to the same symmetrical range", () => {
    const merged = mergeStrandRenderProfile({
      contactOffset: STRAND_CONTACT_SPACING_MAX + 0.5,
      spacingAdjustment: STRAND_CONTACT_SPACING_MIN - 0.5,
    });
    expect(merged.contactOffset).toBe(STRAND_CONTACT_SPACING_MAX);
    expect(merged.spacingAdjustment).toBe(STRAND_CONTACT_SPACING_MIN);
  });
});
