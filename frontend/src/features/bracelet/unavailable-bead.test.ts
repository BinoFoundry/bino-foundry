import { describe, expect, it } from "vitest";

import {
  createUnavailablePlacedBead,
  isBeadVisibleInBuilder,
  isUnavailablePlacedBead,
  strandHasUnavailableBeads,
} from "./unavailable-bead";

describe("unavailable bead placeholders", () => {
  it("marks placeholder beads for rendering", () => {
    const placed = createUnavailablePlacedBead({
      position: 2,
      sizeMm: 8,
      issue: "deleted",
      savedPublicId: "bead-123",
    });
    expect(isUnavailablePlacedBead(placed)).toBe(true);
    expect(placed.bead.name).toBe("Unavailable Bead");
    expect(placed.bead.metadata?.catalogIssue).toBe("deleted");
  });

  it("detects strands that still need replacement", () => {
    const unavailable = createUnavailablePlacedBead({
      position: 0,
      sizeMm: 6,
      issue: "deleted",
    });
    expect(strandHasUnavailableBeads([unavailable], [])).toBe(true);
    expect(strandHasUnavailableBeads([], [])).toBe(false);
  });

  it("uses database-driven builder visibility", () => {
    const statuses = new Map([
      ["ACTIVE", { showInBuilder: true }],
      ["INACTIVE", { showInBuilder: false }],
    ]);
    expect(
      isBeadVisibleInBuilder({ id: "a", name: "A", image: "", beadTypeId: "t", description: "", availabilityStatusCode: "ACTIVE" }, statuses),
    ).toBe(true);
    expect(
      isBeadVisibleInBuilder({ id: "b", name: "B", image: "", beadTypeId: "t", description: "", availabilityStatusCode: "INACTIVE" }, statuses),
    ).toBe(false);
  });
});
