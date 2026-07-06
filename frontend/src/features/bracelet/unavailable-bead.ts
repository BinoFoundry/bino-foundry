import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

export const UNAVAILABLE_BEAD_MARKER = "__unavailable_bead__";

export type UnavailableBeadIssue = "deleted" | "unavailable";

export function isUnavailablePlacedBead(bead: PlacedBead): boolean {
  return bead.bead.metadata?.catalogIssue != null;
}

export function unavailableIssueForPlaced(bead: PlacedBead): UnavailableBeadIssue | null {
  const issue = bead.bead.metadata?.catalogIssue;
  if (issue === "deleted" || issue === "unavailable") return issue;
  return null;
}

export function createUnavailablePlacedBead(params: {
  position: number;
  sizeMm: number;
  issue: UnavailableBeadIssue;
  savedPublicId?: string;
  unitPrice?: number;
}): PlacedBead {
  const savedId = params.savedPublicId?.trim() || UNAVAILABLE_BEAD_MARKER;
  const bead: BeadLibraryEntry = {
    id: savedId,
    name: "Unavailable Bead",
    image: "",
    beadTypeId: "",
    beadTypeSlug: "crystal",
    description: "",
    metadata: {
      catalogIssue: params.issue,
      isPlaceholder: true,
    },
  };
  const size: BeadLibrarySizeOffer = {
    id: `unavailable-${savedId}-${params.sizeMm}`,
    offerKey: `unavailable-${savedId}-${params.sizeMm}`,
    beadLibraryId: savedId,
    beadSizeId: "",
    sizeMm: params.sizeMm,
    label: `${params.sizeMm} mm`,
    unitPrice: params.unitPrice ?? 0,
  };
  return {
    position: params.position,
    bead,
    size,
  };
}

export function countUnavailablePlacedBeads(placed: PlacedBead[]): number {
  return placed.filter(isUnavailablePlacedBead).length;
}

export function strandHasUnavailableBeads(placedA: PlacedBead[], placedB: PlacedBead[]): boolean {
  return countUnavailablePlacedBeads(placedA) > 0 || countUnavailablePlacedBeads(placedB) > 0;
}

export function isBeadVisibleInBuilder(
  bead: BeadLibraryEntry,
  statusByCode: Map<string, { showInBuilder: boolean }>,
): boolean {
  const code = bead.availabilityStatusCode ?? (bead.isActive === false ? "INACTIVE" : "ACTIVE");
  const status = statusByCode.get(code);
  if (status) return status.showInBuilder;
  return bead.isActive !== false;
}
