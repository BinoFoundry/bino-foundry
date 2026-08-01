import { describe, expect, it } from "vitest";

import { snapshotsEqual, stableSerialize } from "./stable-serialize";

describe("stableSerialize", () => {
  it("ignores key order", () => {
    expect(stableSerialize({ b: 1, a: 2 })).toBe(stableSerialize({ a: 2, b: 1 }));
  });

  it("treats undefined fields as absent", () => {
    expect(snapshotsEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  it("detects nested changes", () => {
    expect(snapshotsEqual({ meta: { x: 1 } }, { meta: { x: 2 } })).toBe(false);
  });
});
