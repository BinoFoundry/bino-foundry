import { describe, expect, it } from "vitest";

import { beadMatchesLibrarySearch, buildBeadSearchIndex } from "@/lib/bead-library-search";
import type { BeadLibraryEntry } from "@/types/beads";

function bead(overrides: Partial<BeadLibraryEntry> = {}): BeadLibraryEntry {
  return {
    id: "b1",
    name: "Tiger Eye",
    image: "",
    beadTypeId: "t1",
    description: "",
    tags: [],
    ...overrides,
  };
}

describe("beadMatchesLibrarySearch", () => {
  it("matches bead name", () => {
    expect(beadMatchesLibrarySearch(bead({ name: "Blue Lace Agate" }), "blue")).toBe(true);
  });

  it("matches tag names", () => {
    expect(
      beadMatchesLibrarySearch(
        bead({ name: "Dog", tags: [{ id: "1", name: "Animal", slug: "animal" }] }),
        "animal",
      ),
    ).toBe(true);
  });

  it("returns all beads for empty query", () => {
    expect(beadMatchesLibrarySearch(bead(), "")).toBe(true);
  });
});

describe("buildBeadSearchIndex", () => {
  it("indexes names and tags together", () => {
    const index = buildBeadSearchIndex([
      bead({ id: "a", name: "Rose", tags: [{ id: "1", name: "Pink", slug: "pink" }] }),
    ]);
    expect(index.get("a")).toContain("pink");
  });
});
