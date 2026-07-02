import { describe, expect, it, vi, afterEach } from "vitest";

import { resolveBeadIndexUnderPointer } from "./strand-reorder-hit-test";
import { swapPlacedBeads } from "./sequence-reorder";
import type { PlacedBead } from "@/lib/luxe-data";

function bead(id: string, position: number): PlacedBead {
  return {
    position,
    bead: {
      id,
      name: id,
      image: "",
      beadTypeId: "t",
      description: "",
    },
    size: {
      id: `v-${id}`,
      beadLibraryId: id,
      beadSizeId: `s-${id}`,
      sizeMm: 8,
      unitPrice: 8,
      label: "8 mm",
      offerKey: `${id}-8`,
    },
  };
}

describe("resolveBeadIndexUnderPointer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("returns the bead index from the element under the pointer", () => {
    const boundary = document.createElement("div");
    const slot = document.createElement("div");
    slot.setAttribute("data-strand-slot", "");
    slot.dataset.beadIndex = "4";
    boundary.appendChild(slot);
    document.body.appendChild(boundary);

    vi.stubGlobal("document", {
      ...document,
      elementsFromPoint: vi.fn(() => [slot]),
    });

    expect(resolveBeadIndexUnderPointer(12, 34, { boundary })).toBe(4);
  });

  it("skips the excluded source index and keeps searching", () => {
    const boundary = document.createElement("div");
    const source = document.createElement("div");
    source.setAttribute("data-strand-slot", "");
    source.dataset.beadIndex = "2";
    const target = document.createElement("div");
    target.setAttribute("data-strand-slot", "");
    target.dataset.beadIndex = "5";
    boundary.append(source, target);
    document.body.appendChild(boundary);

    vi.stubGlobal("document", {
      ...document,
      elementsFromPoint: vi.fn(() => [source, target]),
    });

    expect(resolveBeadIndexUnderPointer(0, 0, { boundary, excludeIndex: 2 })).toBe(5);
  });
});

describe("swapPlacedBeads acceptance", () => {
  it("swaps only the dragged and target indices through chained operations", () => {
    let sequence = ["A", "B", "C", "D", "E", "F"].map((id, i) => bead(id, i));

    sequence = swapPlacedBeads(sequence, 0, 4);
    expect(sequence.map((b) => b.bead.id)).toEqual(["E", "B", "C", "D", "A", "F"]);

    sequence = swapPlacedBeads(sequence, 3, 1);
    expect(sequence.map((b) => b.bead.id)).toEqual(["E", "D", "C", "B", "A", "F"]);

    sequence = swapPlacedBeads(sequence, 5, 2);
    expect(sequence.map((b) => b.bead.id)).toEqual(["E", "D", "F", "B", "A", "C"]);
  });
});
