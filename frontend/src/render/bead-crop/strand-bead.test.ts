import { describe, expect, it } from "vitest";

import { mmToBasePx } from "./strand-bead";

describe("mmToBasePx", () => {
  const sf = 1;

  it("preserves mm diameter ordering at a fixed scale factor", () => {
    const six = mmToBasePx(6, sf);
    const eight = mmToBasePx(8, sf);
    const ten = mmToBasePx(10, sf);
    const twelve = mmToBasePx(12, sf);
    expect(six).toBeLessThan(eight);
    expect(eight).toBeLessThan(ten);
    expect(ten).toBeLessThan(twelve);
  });

  it("scales linearly with mm (proportional to diameter)", () => {
    const eight = mmToBasePx(8, sf);
    const twelve = mmToBasePx(12, sf);
    expect(twelve / eight).toBeCloseTo(12 / 8, 5);
  });
});
