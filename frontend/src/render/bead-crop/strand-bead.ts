import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";

import { beadDisplayImageStyles, getBeadDisplayImageUrl } from "./apply-crop";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";

/** Visual footprint multiplier per bead type (relative to mm-based base size). */
const TYPE_FOOTPRINT: Record<string, { width: number; height: number }> = {
  crystal: { width: 1, height: 1 },
  accent: { width: 1, height: 1 },
  connector: { width: 1, height: 1 },
  separator: { width: 0.75, height: 0.75 },
  charm: { width: 1.28, height: 1.08 },
  spacer: { width: 0.5, height: 0.5 },
};

/**
 * Display-only strand density. Does not affect wrist fit, slot counts, pricing, or DB mm values.
 */
export const STRAND_BEAD_VISUAL_SCALE = 0.96;

export function mmToBasePx(sizeMm: number, scaleFactor: number): number {
  return calibratedVisualDiameterPx(sizeMm) * scaleFactor * STRAND_BEAD_VISUAL_SCALE;
}

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
  const base = mmToBasePx(beadSize, scaleFactor);
  return {
    width: base * (customW ?? typeScale.width),
    height: base * (customH ?? typeScale.height),
  };
}

export function getMaxSlotExtent(slots: { width: number; height: number }[]): number {
  if (!slots.length) return mmToBasePx(8, 1);
  return Math.max(...slots.map((s) => Math.max(s.width, s.height)));
}

/**
 * Arc length along the ring tangent after strand rotation (width axis = tangent).
 * Used for neighbor spacing — not max(width, height), which over-counts radial extent.
 */
export function getBeadTangentArcPx(dim: BeadSlotDimensions): number {
  return dim.width;
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

/** Uniform placeholder size for empty-strand guide (scales with canvas). */
export function getGuideSlotDimensions(scaleFactor: number, beadSizeMm = 8): BeadSlotDimensions {
  const base = mmToBasePx(beadSizeMm, scaleFactor) * 0.94;
  return { width: base, height: base };
}

/** Cord / elastic string behind beads (uses theme CSS variables). */
export const STRAND_CORD = {
  stroke: "hsl(var(--strand-cord) / 0.55)",
  strokeDrag: "hsl(var(--strand-cord-active) / 0.65)",
  widthFactor: 3.4,
  opacity: 0.92,
  opacityComplete: 0.55,
} as const;

/** Visible placeholders when the strand has no beads yet. */
export function getGuideEmptySlotShellStyle(dim: BeadSlotDimensions): CSSProperties {
  return {
    width: dim.width,
    height: dim.height,
    background: "hsl(var(--muted) / 0.55)",
    border: "1.5px dashed hsl(var(--primary) / 0.4)",
    borderRadius: "50%",
    boxShadow:
      "inset 0 1px 3px rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.08)",
  };
}

/** Unfilled slots while the bracelet is still being filled in. */
export function getPartialEmptySlotShellStyle(dim: BeadSlotDimensions): CSSProperties {
  return {
    width: dim.width,
    height: dim.height,
    background: "hsl(var(--muted) / 0.42)",
    border: "1.5px dashed hsl(var(--primary) / 0.28)",
    borderRadius: "50%",
    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.18)",
  };
}

/** @deprecated Prefer partial style until the strand is complete. */
export function getEmptySlotShellStyle(dim: BeadSlotDimensions): CSSProperties {
  return getPartialEmptySlotShellStyle(dim);
}

/** Closed loop through slot centers (bracelet cord / strand path). */
export function buildStrandLoopPath(slots: { x: number; y: number }[]): string {
  if (slots.length < 2) return "";
  let d = `M ${slots[0].x} ${slots[0].y}`;
  for (let i = 1; i < slots.length; i++) {
    d += ` L ${slots[i].x} ${slots[i].y}`;
  }
  return `${d} Z`;
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

/** Hint raster decode size for sharp strand rendering at layout pixel dimensions. */
export function getStrandBeadRasterSize(
  dim: BeadSlotDimensions,
  dpr = typeof globalThis !== "undefined" ? globalThis.devicePixelRatio || 1 : 1,
): { width: number; height: number } {
  const scale = Math.min(3, Math.max(1, dpr));
  return {
    width: Math.ceil(dim.width * scale),
    height: Math.ceil(dim.height * scale),
  };
}
