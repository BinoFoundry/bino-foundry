import { describe, expect, it } from "vitest";

import {
  BEAD_LIBRARY_DRAG_TYPE,
  isInsideScrollablePanel,
  isLibraryDragEvent,
  shouldStartCanvasPan,
} from "./interaction";

describe("isLibraryDragEvent", () => {
  it("recognizes library drag MIME type", () => {
    const dt = {
      types: [BEAD_LIBRARY_DRAG_TYPE],
    } as DataTransfer;
    expect(isLibraryDragEvent({ dataTransfer: dt } as DragEvent)).toBe(true);
  });
});

describe("isInsideScrollablePanel", () => {
  it("detects data-scroll-isolate attribute", () => {
    const panel = document.createElement("div");
    panel.dataset.scrollIsolate = "true";
    const child = document.createElement("span");
    panel.appendChild(child);
    document.body.appendChild(panel);
    expect(isInsideScrollablePanel(child)).toBe(true);
    document.body.removeChild(panel);
  });
});

describe("shouldStartCanvasPan", () => {
  it("allows pan on empty canvas background", () => {
    const canvas = document.createElement("div");
    canvas.dataset.strandCanvas = "";
    const bg = document.createElement("span");
    canvas.appendChild(bg);
    document.body.appendChild(canvas);
    expect(shouldStartCanvasPan(bg)).toBe(true);
    document.body.removeChild(canvas);
  });

  it("blocks pan on strand slots but allows empty drop zone", () => {
    const canvas = document.createElement("div");
    canvas.dataset.strandCanvas = "";
    const slot = document.createElement("button");
    slot.dataset.strandSlot = "";
    canvas.appendChild(slot);
    document.body.appendChild(canvas);
    expect(shouldStartCanvasPan(slot)).toBe(false);

    const drop = document.createElement("div");
    drop.dataset.strandDropZone = "";
    canvas.appendChild(drop);
    expect(shouldStartCanvasPan(drop)).toBe(true);
    document.body.removeChild(canvas);
  });
});
