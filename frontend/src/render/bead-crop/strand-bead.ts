import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";

import { beadDisplayImageStyles, getBeadDisplayImageUrl } from "./apply-crop";

/** Visual footprint multiplier per bead type (relative to mm-based base size). */
const TYPE_FOOTPRINT: Record<string, { width: number; height: number }> = {
  crystal: { width: 1, height: 1 },
  accent: { width: 1, height: 1 },
  connector: { width: 1, height: 1 },
  separator: { width: 0.75, height: 0.75 },
  charm: { width: 1.4, height: 1.15 },
  spacer: { width: 0.5, height: 0.5 },
};

const MM_BASE_PX: Record<BeadSize, number> = { 6: 22, 8: 28, 10: 36 };

export interface BeadSlotDimensions {
  width: number;
  height: number;
}

export function getBeadSlotDimensions(
  bead: PlacedBead | null,
  beadSize: BeadSize,
  scaleFactor: number,
): BeadSlotDimensions {
  const slug = bead?.bead.beadTypeSlug ?? "crystal";
  const meta = bead?.bead.metadata as { strandScale?: { width?: number; height?: number } } | undefined;
  const typeScale = TYPE_FOOTPRINT[slug] ?? TYPE_FOOTPRINT.crystal;
  const customW = meta?.strandScale?.width;
  const customH = meta?.strandScale?.height;
  const base = MM_BASE_PX[beadSize] * scaleFactor;
  return {
    width: base * (customW ?? typeScale.width),
    height: base * (customH ?? typeScale.height),
  };
}

export function getMaxSlotExtent(slots: { width: number; height: number }[]): number {
  if (!slots.length) return MM_BASE_PX[8];
  return Math.max(...slots.map((s) => Math.max(s.width, s.height)));
}

export function getBeadImageUrl(bead: PlacedBead | null): string | null {
  if (!bead) return null;
  const url = getBeadDisplayImageUrl(bead.bead);
  if (!url) return null;
  return url.startsWith("data:") ? url : `${url}?v=2`;
}

/** Image styles: transparent PNG/WebP, no circular clip; path clip only for unprocessed v2. */
export function getStrandBeadImageStyle(bead: BeadLibraryEntry | null | undefined): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    ...beadDisplayImageStyles(bead ?? undefined),
  };
}

export function getEmptySlotShellStyle(dim: BeadSlotDimensions): CSSProperties {
  return {
    width: dim.width,
    height: dim.height,
    background: "transparent",
    border: "1px dashed hsl(var(--border) / 0.7)",
    borderRadius: 4,
    boxShadow: "none",
  };
}

export function getPlacedBeadShellStyle(
  dim: BeadSlotDimensions,
  hasImage: boolean,
): CSSProperties {
  return {
    width: dim.width,
    height: dim.height,
    background: hasImage ? "transparent" : "hsl(var(--muted) / 0.35)",
    border: hasImage ? "none" : "1px solid hsl(var(--border) / 0.5)",
    borderRadius: hasImage ? 0 : 4,
    boxShadow: hasImage ? "none" : "inset 0 1px 2px rgba(0,0,0,0.06)",
    overflow: "visible",
  };
}

export function getPlacedBeadImageFilter(): CSSProperties["filter"] {
  return "drop-shadow(0 1px 2px rgba(0,0,0,0.2)) drop-shadow(0 3px 8px rgba(0,0,0,0.12))";
}
