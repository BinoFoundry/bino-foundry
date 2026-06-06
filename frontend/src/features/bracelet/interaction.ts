/** MIME type for library → strand HTML5 drag payloads. */
export const BEAD_LIBRARY_DRAG_TYPE = "application/vnd.bino.bead+json";

export function isLibraryDragEvent(e: React.DragEvent | DragEvent): boolean {
  return e.dataTransfer.types.includes(BEAD_LIBRARY_DRAG_TYPE);
}

/** True when the event target is inside a vertically scrollable panel (library, admin, summary). */
export function isInsideScrollablePanel(target: EventTarget | null, boundary?: HTMLElement | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el) {
    if (boundary && el === boundary) return false;
    if (el.dataset.scrollIsolate === "true") return true;
    const { overflowY } = getComputedStyle(el);
    const scrollable =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight + 1;
    if (scrollable) return true;
    el = el.parentElement;
  }
  return false;
}

/** Wheel zoom should only run on the strand canvas surface, not side panels. */
export function shouldApplyCanvasWheelZoom(
  e: WheelEvent,
  zoomSurface: HTMLElement,
): boolean {
  const target = e.target;
  if (!(target instanceof Node) || !zoomSurface.contains(target)) return false;
  if (isInsideScrollablePanel(target, zoomSurface)) return false;
  return true;
}

const PAN_BLOCKING_SELECTOR = [
  "[data-strand-slot]",
  "[data-bead-library-item]",
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
].join(",");

/** True when pointer down should pan the canvas (empty strand / viewport margin only). */
export function shouldStartCanvasPan(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(PAN_BLOCKING_SELECTOR)) return false;
  return !!target.closest("[data-strand-canvas], [data-strand-viewport], [data-strand-drop-zone]");
}
