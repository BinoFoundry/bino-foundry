import { describe, expect, it } from "vitest";

import { isFramePiece } from "./frame-placement-intent";

const types = [
  { id: "t-cap", slug: "bead-cap", placementMode: "frame" as const },
  { id: "t-crystal", slug: "crystal", placementMode: "replace" as const },
  { id: "t-spacer", slug: "spacer", placementMode: "insert_between" as const },
];

describe("isFramePiece", () => {
  it("recognises a frame piece by its type id", () => {
    expect(isFramePiece({ beadTypeId: "t-cap", beadTypeSlug: undefined }, types)).toBe(true);
  });

  it("recognises one by slug when the id is missing", () => {
    expect(isFramePiece({ beadTypeId: "", beadTypeSlug: "bead-cap" }, types)).toBe(true);
  });

  it("leaves ordinary pieces alone", () => {
    expect(isFramePiece({ beadTypeId: "t-crystal", beadTypeSlug: "crystal" }, types)).toBe(false);
    expect(isFramePiece({ beadTypeId: "t-spacer", beadTypeSlug: "spacer" }, types)).toBe(false);
  });

  it("is false for an unknown type or no bead", () => {
    expect(isFramePiece({ beadTypeId: "gone", beadTypeSlug: "gone" }, types)).toBe(false);
    expect(isFramePiece(null, types)).toBe(false);
    expect(isFramePiece({ beadTypeId: "t-cap", beadTypeSlug: "bead-cap" }, [])).toBe(false);
  });
});
