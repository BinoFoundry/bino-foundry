/**
 * Measure the painted strand extent including overflow:visible dangling shells.
 *
 * Camera Fit uses these layout-space bounds so hanging charms reframe instead of
 * clipping inside overflow-hidden viewports — especially at large wrist fill (e.g. 20 cm).
 *
 * Uses offset geometry (not getBoundingClientRect under CSS transform) so results
 * stay in layout coordinates while the camera scale is applied on the content host.
 */

function expandBox(
  box: { minX: number; minY: number; maxX: number; maxY: number; has: boolean },
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom)
  ) {
    return;
  }
  if (!box.has) {
    box.minX = left;
    box.minY = top;
    box.maxX = right;
    box.maxY = bottom;
    box.has = true;
    return;
  }
  box.minX = Math.min(box.minX, left);
  box.minY = Math.min(box.minY, top);
  box.maxX = Math.max(box.maxX, right);
  box.maxY = Math.max(box.maxY, bottom);
}

/** Sum offsetLeft/Top through the offsetParent chain until `stop`. */
export function offsetRelativeTo(el: HTMLElement, stop: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== stop) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent;
    if (!(parent instanceof HTMLElement)) break;
    if (parent !== stop && !stop.contains(parent)) break;
    node = parent;
  }
  return { x, y };
}

/**
 * Union of stage chrome + every `[data-strand-slot]` shell (and nested imgs).
 * Slot boxes may extend past the canvas when dangling hang pushes outward.
 */
export function measureStrandContentExtent(content: HTMLElement): {
  width: number;
  height: number;
} {
  const box = { minX: 0, minY: 0, maxX: 0, maxY: 0, has: false };

  for (const child of Array.from(content.children)) {
    if (!(child instanceof HTMLElement)) continue;
    expandBox(
      box,
      child.offsetLeft,
      child.offsetTop,
      child.offsetLeft + child.offsetWidth,
      child.offsetTop + child.offsetHeight,
    );
  }

  const canvases = content.querySelectorAll<HTMLElement>("[data-strand-canvas]");
  if (canvases.length) {
    for (const canvas of canvases) {
      const canvasPos = offsetRelativeTo(canvas, content);
      expandBox(
        box,
        canvasPos.x,
        canvasPos.y,
        canvasPos.x + canvas.offsetWidth,
        canvasPos.y + canvas.offsetHeight,
      );

      for (const slot of canvas.querySelectorAll<HTMLElement>("[data-strand-slot]")) {
        // Slots are absolutely positioned against the canvas (position: relative).
        const left = canvasPos.x + slot.offsetLeft;
        const top = canvasPos.y + slot.offsetTop;
        expandBox(box, left, top, left + slot.offsetWidth, top + slot.offsetHeight);

        for (const img of slot.querySelectorAll<HTMLElement>("img")) {
          expandBox(
            box,
            left + img.offsetLeft,
            top + img.offsetTop,
            left + img.offsetLeft + img.offsetWidth,
            top + img.offsetTop + img.offsetHeight,
          );
        }
      }
    }
  } else {
    for (const slot of content.querySelectorAll<HTMLElement>("[data-strand-slot]")) {
      const pos = offsetRelativeTo(slot, content);
      expandBox(box, pos.x, pos.y, pos.x + slot.offsetWidth, pos.y + slot.offsetHeight);
    }
  }

  if (!box.has) {
    return {
      width: Math.max(1, content.scrollWidth || content.offsetWidth || 1),
      height: Math.max(1, content.scrollHeight || content.offsetHeight || 1),
    };
  }

  return {
    width: Math.max(1, box.maxX - box.minX),
    height: Math.max(1, box.maxY - box.minY),
  };
}

/**
 * Clamp painted bounds used for camera Fit.
 * Pathological offset measurements (or mid-remount layouts) can report huge boxes;
 * that crushes fitScale while the zoom label stays at 300% and the strand looks tiny.
 */
export function sanitizeMeasuredContentExtent(
  measured: { width: number; height: number },
  layoutCanvasSizePx: number,
): { width: number; height: number } {
  const canvas = Math.max(1, layoutCanvasSizePx);
  // Allow dangling hang past the square canvas, but not unbounded.
  const maxDim = canvas * 2.5;
  const minDim = canvas * 0.5;
  const clamp = (v: number) => Math.min(maxDim, Math.max(minDim, Number.isFinite(v) && v > 0 ? v : canvas));
  return {
    width: clamp(measured.width),
    height: clamp(measured.height),
  };
}
