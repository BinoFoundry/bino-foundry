import { describe, expect, it } from "vitest";

import { normalizedExportDiameterMatchesTarget } from "@bino-foundry/shared/types";

describe("normalizedExportDiameterMatchesTarget", () => {
  it("accepts sub-percent anti-aliasing delta on large targets", () => {
    expect(normalizedExportDiameterMatchesTarget(1083, 1080)).toBe(true);
  });

  it("accepts within 5px on small targets", () => {
    expect(normalizedExportDiameterMatchesTarget(54, 50)).toBe(true);
  });

  it("rejects meaningful scale misses", () => {
    expect(normalizedExportDiameterMatchesTarget(900, 1080)).toBe(false);
    expect(normalizedExportDiameterMatchesTarget(418, 1080)).toBe(false);
  });
});
