/**
 * Resolve which strand bead index is under the pointer using DOM hit-testing.
 * Reorder must never use angle, arc, or layout sectors — only element hits.
 */
export function resolveBeadIndexUnderPointer(
  clientX: number,
  clientY: number,
  options: {
    boundary: HTMLElement | null;
    excludeIndex?: number | null;
  },
): number | null {
  const { boundary, excludeIndex } = options;
  if (!boundary) return null;

  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (!(el instanceof Element) || !boundary.contains(el)) continue;

    const slot = el.closest("[data-strand-slot][data-bead-index]");
    if (!(slot instanceof HTMLElement)) continue;

    const index = Number.parseInt(slot.dataset.beadIndex ?? "", 10);
    if (!Number.isFinite(index)) continue;
    if (excludeIndex !== null && excludeIndex !== undefined && index === excludeIndex) continue;
    return index;
  }

  return null;
}
