import { describe, expect, it } from "vitest";

import { resolveLibraryDropTarget } from "./strand-elastic-layout";
import { getPlacedBeadPrice } from "@/lib/luxe-data";
import { parseBeadPlacementMode } from "@bino-foundry/shared/types";

/** Four evenly spaced bead slots, in the shape the layout actually produces. */
const sectors = [0, 1, 2, 3].map((i) => ({
  index: i,
  angle: (i * Math.PI) / 2,
  arcSpan: Math.PI / 2,
}));
/** Gaps sit midway between adjacent beads. */
const insertionAngles = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4);
const placed = [0, 1, 2, 3].map(() => ({ beadTypeId: "crystal", subBeadTypeId: null }));
const ring = { beadTypeId: "halo", subBeadTypeId: null };

describe("frame placement mode", () => {
  it("is accepted by the placement-mode parser", () => {
    expect(parseBeadPlacementMode("frame")).toBe("frame");
    expect(parseBeadPlacementMode("nonsense")).toBe("replace");
  });

  it("attaches to the bead under the pointer", () => {
    const target = resolveLibraryDropTarget({
      pointerAngle: sectors[2].angle,
      sectors,
      insertionAngles,
      placementMode: "frame",
      dragged: ring,
      placedTypeRefs: placed,
    });
    expect(target).toEqual({ mode: "frame", index: 2 });
  });

  it("never replaces or inserts, even over a bead of a different type", () => {
    const target = resolveLibraryDropTarget({
      pointerAngle: sectors[0].angle,
      sectors,
      insertionAngles,
      placementMode: "frame",
      dragged: ring,
      placedTypeRefs: placed,
    });
    expect(target.mode).toBe("frame");
  });

  it("does nothing when released between beads — no loose ring on the cord", () => {
    const between = insertionAngles[0];
    const target = resolveLibraryDropTarget({
      pointerAngle: between,
      sectors,
      insertionAngles,
      placementMode: "frame",
      dragged: ring,
      placedTypeRefs: placed,
    });
    expect(target.mode).toBe("frame");
    expect(target.index).toBe(-1);
  });

  it("leaves replace and insert_between behaviour untouched", () => {
    const replaceTarget = resolveLibraryDropTarget({
      pointerAngle: sectors[1].angle,
      sectors,
      insertionAngles,
      placementMode: "replace",
      dragged: placed[0],
      placedTypeRefs: placed,
    });
    expect(replaceTarget).toEqual({ mode: "replace", index: 1 });
  });

  it("charges for the frame as well as the bead", () => {
    const bead = {
      position: 0,
      bead: {} as never,
      size: { unitPrice: 12 } as never,
    };
    expect(getPlacedBeadPrice(bead)).toBe(12);
    expect(
      getPlacedBeadPrice({ ...bead, frame: { bead: {} as never, size: { unitPrice: 8 } as never } }),
    ).toBe(20);
  });
});
