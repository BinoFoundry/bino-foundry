import type { PlacedBead } from "@/lib/luxe-data";

export function createPlacementInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Stable per-placement id for React keys and drag-and-drop (survives reorder). */
export function placedBeadInstanceId(bead: PlacedBead): string {
  if (bead.instanceId) return bead.instanceId;
  return `legacy:${bead.position}:${bead.bead.id}:${bead.size.offerKey}`;
}

export function ensurePlacementInstanceIds(placed: PlacedBead[]): PlacedBead[] {
  if (placed.every((b) => b.instanceId)) return placed;
  return placed.map((b) =>
    b.instanceId ? b : { ...b, instanceId: createPlacementInstanceId() },
  );
}

/** After moving one item in a dense array, remap a stored index (e.g. selection). */
export function remapIndexAfterMove(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < to) {
    if (index > from && index <= to) return index - 1;
  } else if (from > to) {
    if (index >= to && index < from) return index + 1;
  }
  return index;
}

export function logPlacementOrder(phase: string, placed: PlacedBead[]): void {
  if (!import.meta.env.DEV) return;
  console.info(`[bracelet-order] ${phase}`, {
    sequence: placed.map((b, i) => ({
      instanceId: placedBeadInstanceId(b),
      type: b.bead.id,
      currentIndex: i,
      positionField: b.position,
    })),
  });
}
