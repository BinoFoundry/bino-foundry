import { describe, expect, it } from "vitest";

import {
  coerceVerticalOffsetPercent,
  effectiveStrandContactWidth,
  contactWidthStoredToTuningDelta,
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  STRAND_CONTACT_SPACING_MAX,
  STRAND_CONTACT_SPACING_MIN,
  STRAND_LAYOUT_SCALE_MAX,
  STRAND_VERTICAL_OFFSET_UNIT_PERCENT,
  STRAND_VISUAL_SCALE_MAX,
  STRAND_VISUAL_SIZE_SCALING_MAX,
  STRAND_VISUAL_SIZE_SCALING_MIN,
  strandContactSpacingMin,
  verticalOffsetHeightFraction,
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
        contactOffset: 10,
        spacingAdjustment: 10,
      }),
    ).toBe(STRAND_CONTACT_SPACING_MAX);
  });
});

describe("mergeStrandRenderProfile calibration ranges", () => {
  it("syncs anchorX/Y when preset changes even if stale coords were stored", () => {
    const merged = mergeStrandRenderProfile(
      { anchorPreset: "center", anchorX: 0.5, anchorY: 0.5 },
      { anchorPreset: "loop", anchorX: 0.5, anchorY: 0.5 },
    );
    expect(merged.anchorPreset).toBe("loop");
    expect(merged.anchorX).toBe(0.5);
    expect(merged.anchorY).toBe(0.08);
  });

  it("preserves layout scale values inside the explicit range (no 1.1 remapping)", () => {
    const merged = mergeStrandRenderProfile({ layoutScale: 2 });
    expect(merged.layoutScale).toBe(2);
  });

  it("clamps layout scale only to the explicit allowed bounds", () => {
    expect(mergeStrandRenderProfile({ layoutScale: 9 }).layoutScale).toBe(STRAND_LAYOUT_SCALE_MAX);
    expect(mergeStrandRenderProfile({ layoutScale: 0.01 }).layoutScale).toBe(0.1);
  });

  it("accepts negative contact width within symmetrical range", () => {
    const merged = mergeStrandRenderProfile({ contactWidth: -1.2 });
    expect(merged.contactWidth).toBeCloseTo(-1.2, 5);
  });

  it("clamps contact width to configured symmetrical bounds", () => {
    const merged = mergeStrandRenderProfile({ contactWidth: -25 });
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

  it("preserves render calibration and vertical offset 1:1 inside range", () => {
    const merged = mergeStrandRenderProfile({ visualScale: 2, verticalOffset: -5 });
    expect(merged.visualScale).toBe(2);
    expect(merged.verticalOffset).toBe(-5);
  });

  it("clamps visual scale only to explicit bounds", () => {
    expect(mergeStrandRenderProfile({ visualScale: 9 }).visualScale).toBe(STRAND_VISUAL_SCALE_MAX);
  });

  it("defaults visualSizeScaling to linear when omitted", () => {
    expect(mergeStrandRenderProfile({}).visualSizeScaling).toBe(1);
  });

  it("clamps visualSizeScaling to explicit bounds", () => {
    expect(mergeStrandRenderProfile({ visualSizeScaling: 0.01 }).visualSizeScaling).toBe(
      STRAND_VISUAL_SIZE_SCALING_MIN,
    );
    expect(mergeStrandRenderProfile({ visualSizeScaling: 9 }).visualSizeScaling).toBe(
      STRAND_VISUAL_SIZE_SCALING_MAX,
    );
  });

  it("parses visualSizeScaling from stored JSON", () => {
    expect(parseStrandRenderProfile({ visualSizeScaling: 0.7 })?.visualSizeScaling).toBe(0.7);
  });
});

describe("verticalOffset percent units", () => {
  it("converts height fraction for layout math", () => {
    expect(verticalOffsetHeightFraction(-5)).toBeCloseTo(-0.05, 5);
    expect(verticalOffsetHeightFraction(0)).toBe(0);
  });

  it("coerces legacy fraction storage to percent once", () => {
    expect(coerceVerticalOffsetPercent(-0.1)).toBeCloseTo(-10, 5);
    expect(coerceVerticalOffsetPercent(0.05)).toBeCloseTo(5, 5);
  });

  it("keeps percent values when unit marker is present", () => {
    expect(coerceVerticalOffsetPercent(0.5, STRAND_VERTICAL_OFFSET_UNIT_PERCENT)).toBe(0.5);
    expect(coerceVerticalOffsetPercent(-5, STRAND_VERTICAL_OFFSET_UNIT_PERCENT)).toBe(-5);
  });

  it("parses legacy verticalOffset fractions into percent", () => {
    const parsed = parseStrandRenderProfile({ verticalOffset: -0.1 });
    expect(parsed?.verticalOffset).toBeCloseTo(-10, 5);
  });

  it("parses marked percent verticalOffset 1:1", () => {
    const parsed = parseStrandRenderProfile({
      verticalOffset: 0.5,
      verticalOffsetUnit: STRAND_VERTICAL_OFFSET_UNIT_PERCENT,
    });
    expect(parsed?.verticalOffset).toBe(0.5);
  });
});
