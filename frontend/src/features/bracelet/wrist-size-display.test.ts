import { describe, expect, it } from "vitest";

import {
  formatWristSizeCm,
  isDuplicateSizeLabel,
  wristSizeDescriptor,
} from "./wrist-size-display";

describe("formatWristSizeCm", () => {
  it("formats whole and decimal centimetres", () => {
    expect(formatWristSizeCm(14)).toBe("14");
    expect(formatWristSizeCm(13.5)).toBe("13.5");
    expect(formatWristSizeCm(14.5)).toBe("14.5");
  });
});

describe("wrist size labels", () => {
  it("detects redundant labels", () => {
    expect(isDuplicateSizeLabel("14 cm", 14)).toBe(true);
    expect(isDuplicateSizeLabel("14cm", 14)).toBe(true);
    expect(isDuplicateSizeLabel("13.5 cm", 13.5)).toBe(true);
    expect(isDuplicateSizeLabel("14 centimetres", 14)).toBe(true);
    expect(isDuplicateSizeLabel("14\u00a0cm", 14)).toBe(true);
    expect(isDuplicateSizeLabel("Petite", 14)).toBe(false);
  });

  it("extracts descriptors without repeating the size", () => {
    expect(wristSizeDescriptor("14 cm", 14)).toBeNull();
    expect(wristSizeDescriptor("Petite · 14 cm", 14)).toBe("Petite");
    expect(wristSizeDescriptor("Petite", 14)).toBe("Petite");
  });
});
