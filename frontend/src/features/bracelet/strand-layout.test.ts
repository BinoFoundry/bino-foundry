import { describe, expect, it } from "vitest";

import {
  computeSequenceLayoutAngles,
  computeStrandBboxFillScale,
  computeWeightedSlotAngles,
} from "./strand-layout";
import { evenBeadAngleStepRad } from "./strand-path";

describe("computeWeightedSlotAngles", () => {
  it("distributes slots evenly regardless of mm weight", () => {
    const angles = computeWeightedSlotAngles([
      { index: 0, weightMm: 10 },
      { index: 1, weightMm: 4 },
    ]);
    expect(angles).toHaveLength(2);
    expect(angles[1]! - angles[0]!).toBeCloseTo(evenBeadAngleStepRad(2), 5);
  });
});

describe("computeSequenceLayoutAngles", () => {
  it("places beads evenly on a full ring", () => {
    const { beadAngles, insertionAngle } = computeSequenceLayoutAngles([8, 8, 8]);
    expect(beadAngles).toHaveLength(3);
    expect(beadAngles[1]! - beadAngles[0]!).toBeCloseTo(evenBeadAngleStepRad(3), 5);
    expect(insertionAngle).toBeGreaterThan(beadAngles[2]!);
  });
});

describe("computeStrandBboxFillScale", () => {
  it("returns > 1 when content bbox is smaller than canvas", () => {
    const scale = computeStrandBboxFillScale(
      [{ x: 200, y: 200, width: 40, height: 40 }],
      400,
      0.9,
      1.5,
    );
    expect(scale).toBeGreaterThan(1);
  });

  it("caps at maxScale", () => {
    const scale = computeStrandBboxFillScale(
      [{ x: 200, y: 200, width: 20, height: 20 }],
      400,
      0.95,
      1.2,
    );
    expect(scale).toBeLessThanOrEqual(1.2);
  });
});
