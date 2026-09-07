import { parseBeadPlacementMode } from "@bino-foundry/shared/types";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";

/**
 * Does this piece wrap a bead rather than take a place on the cord?
 *
 * Dragging already consulted placement mode, but clicking a library item did
 * not — so a frame added by click was threaded onto the strand as an ordinary
 * item, appearing as a small ornament in the gap between two beads instead of
 * wrapping one.
 */
export function isFramePiece(
  bead: Pick<BeadLibraryEntry, "beadTypeId" | "beadTypeSlug"> | null | undefined,
  beadTypes: Pick<BeadTypeEntry, "id" | "slug" | "placementMode">[],
): boolean {
  if (!bead) return false;
  const type = beadTypes.find(
    (t) => (bead.beadTypeId && t.id === bead.beadTypeId) || (bead.beadTypeSlug && t.slug === bead.beadTypeSlug),
  );
  return parseBeadPlacementMode(type?.placementMode) === "frame";
}
