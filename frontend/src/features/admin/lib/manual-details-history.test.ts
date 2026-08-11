import { describe, expect, it } from "vitest";

import { createFramePart, createCutoutFromPreset } from "./frame-parts";
import {
  captureManualDetailsSnapshot,
  cloneManualDetailParts,
  isTypingInFormField,
  manualDetailsPartsEqual,
} from "./manual-details-history";

describe("manual-details-history", () => {
  it("deep-clones parts including holes and shape presets", () => {
    const part = createFramePart("Rivet", "ellipse");
    const hole = createCutoutFromPreset(part.points, "rectangle", "Cutout 1");
    part.holes = [hole];
    const clone = cloneManualDetailParts([part]);
    expect(clone[0]!.id).toBe(part.id);
    expect(clone[0]!.shapePreset).toBe("ellipse");
    expect(clone[0]!.holes?.[0]?.shapePreset).toBe("rectangle");
    clone[0]!.points[0]!.x = 0;
    expect(part.points[0]!.x).not.toBe(0);
  });

  it("captures selection with the snapshot", () => {
    const part = createFramePart("A", "rectangle");
    const snap = captureManualDetailsSnapshot([part], 0, 0);
    expect(snap.activePartIndex).toBe(0);
    expect(snap.activeSubpath).toBe(0);
    expect(snap.parts).toHaveLength(1);
  });

  it("does not store Transform/Edit Shape navigation in history snapshots", () => {
    const part = createFramePart("A", "rectangle");
    const snap = captureManualDetailsSnapshot([part], 0, "outer");
    expect(Object.keys(snap).sort()).toEqual(["activePartIndex", "activeSubpath", "parts"]);
    expect(snap).not.toHaveProperty("editPhase");
    expect(snap).not.toHaveProperty("activeTab");
  });

  it("treats cloned parts as equal so hydrate commits can skip history", () => {
    const part = createFramePart("Rivet", "ellipse");
    const hole = createCutoutFromPreset(part.points, "rectangle", "Cutout 1");
    part.holes = [hole];
    const clone = cloneManualDetailParts([part]);
    expect(manualDetailsPartsEqual([part], clone)).toBe(true);
    clone[0]!.points[0]!.x += 1;
    expect(manualDetailsPartsEqual([part], clone)).toBe(false);
  });

  it("detects typing targets so Delete does not steal keystrokes", () => {
    const input = document.createElement("input");
    expect(isTypingInFormField(input)).toBe(true);
    const div = document.createElement("div");
    expect(isTypingInFormField(div)).toBe(false);
  });
});
