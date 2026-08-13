import { describe, expect, it } from "vitest";

import {
  measureStrandContentExtent,
  offsetRelativeTo,
  sanitizeMeasuredContentExtent,
} from "./strand-content-extent";

function stubBox(
  el: HTMLElement,
  box: { left: number; top: number; width: number; height: number },
  offsetParent: HTMLElement | null,
) {
  Object.defineProperty(el, "offsetLeft", { configurable: true, get: () => box.left });
  Object.defineProperty(el, "offsetTop", { configurable: true, get: () => box.top });
  Object.defineProperty(el, "offsetWidth", { configurable: true, get: () => box.width });
  Object.defineProperty(el, "offsetHeight", { configurable: true, get: () => box.height });
  Object.defineProperty(el, "offsetParent", { configurable: true, get: () => offsetParent });
}

describe("measureStrandContentExtent", () => {
  it("expands past the canvas when dangling slots hang outward", () => {
    const content = document.createElement("div");
    stubBox(content, { left: 0, top: 0, width: 200, height: 200 }, null);

    const stage = document.createElement("div");
    stubBox(stage, { left: 0, top: 0, width: 200, height: 200 }, content);
    content.appendChild(stage);

    const canvas = document.createElement("div");
    canvas.setAttribute("data-strand-canvas", "");
    stubBox(canvas, { left: 0, top: 0, width: 200, height: 200 }, stage);
    stage.appendChild(canvas);

    const slot = document.createElement("div");
    slot.setAttribute("data-strand-slot", "");
    // Hang past the bottom edge (typical dangling charm).
    stubBox(slot, { left: 80, top: 160, width: 40, height: 90 }, canvas);
    canvas.appendChild(slot);

    const extent = measureStrandContentExtent(content);
    // Canvas 200 + overhang past bottom (160+90-200 = 50) ⇒ 250.
    expect(extent.height).toBe(250);
    expect(extent.width).toBe(200);
  });

  it("includes negative slot offsets on the leading edge", () => {
    const content = document.createElement("div");
    stubBox(content, { left: 0, top: 0, width: 200, height: 200 }, null);

    const canvas = document.createElement("div");
    canvas.setAttribute("data-strand-canvas", "");
    stubBox(canvas, { left: 0, top: 0, width: 200, height: 200 }, content);
    content.appendChild(canvas);

    const slot = document.createElement("div");
    slot.setAttribute("data-strand-slot", "");
    stubBox(slot, { left: -30, top: 80, width: 50, height: 40 }, canvas);
    canvas.appendChild(slot);

    const extent = measureStrandContentExtent(content);
    expect(extent.width).toBe(230);
    expect(extent.height).toBe(200);
  });
});

describe("sanitizeMeasuredContentExtent", () => {
  it("clamps pathological huge bounds that would crush camera fitScale", () => {
    const sanitized = sanitizeMeasuredContentExtent({ width: 8000, height: 8000 }, 320);
    expect(sanitized.width).toBe(320 * 2.5);
    expect(sanitized.height).toBe(320 * 2.5);
  });

  it("keeps normal dangling overhang within the clamp", () => {
    const sanitized = sanitizeMeasuredContentExtent({ width: 320, height: 420 }, 320);
    expect(sanitized.width).toBe(320);
    expect(sanitized.height).toBe(420);
  });
});

describe("offsetRelativeTo", () => {
  it("sums offsetLeft/Top through the offsetParent chain", () => {
    const root = document.createElement("div");
    const mid = document.createElement("div");
    const leaf = document.createElement("div");
    stubBox(root, { left: 0, top: 0, width: 100, height: 100 }, null);
    stubBox(mid, { left: 10, top: 20, width: 80, height: 80 }, root);
    stubBox(leaf, { left: 5, top: 7, width: 10, height: 10 }, mid);
    root.appendChild(mid);
    mid.appendChild(leaf);

    expect(offsetRelativeTo(leaf, root)).toEqual({ x: 15, y: 27 });
  });
});
