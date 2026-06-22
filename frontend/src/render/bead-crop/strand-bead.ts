import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";

import { beadDisplayImageStyles, getBeadDisplayImageUrl } from "./apply-crop";
import { resolveBeadVisualBoundsNorm } from "./crop-visual-bounds";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";

/** Subtle type tweaks — applied after crop-aware sizing, not as size substitutes. */
const TYPE_FOOTPRINT: Record<string, { width: number; height: number }> = {
  crystal: { width: 1, height: 1 },
  accent: { width: 1, height: 1 },
  connector: { width: 1, height: 1 },
  separator: { width: 1, height: 1 },
  charm: { width: 1, height: 1 },
  spacer: { width: 1, height: 1 },
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

/**
 * Crop-aware footprint: wrapper matches the visible silhouette aspect ratio.
 * Physical mm maps to the largest cropped dimension — no inflation beyond the crop.
 */
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

  const visual = resolveBeadVisualBoundsNorm(bead?.bead);
  const basePx = mmToBasePx(beadSize, scaleFactor);
  const maxNorm = Math.max(visual.width, visual.height, 0.001);
  const pxPerNorm = basePx / maxNorm;

  const width = visual.width * pxPerNorm * (customW ?? typeScale.width);
  const height = visual.height * pxPerNorm * (customH ?? typeScale.height);

  return { width, height };
}

export function getMaxSlotExtent(slots: { width: number; height: number }[]): number {
  if (!slots.length) return mmToBasePx(8, 1);
  return Math.max(...slots.map((s) => Math.max(s.width, s.height)));
}

/**
 * Arc length along the ring tangent — uses the larger crop-aware dimension
 * so rotated charms do not overlap neighbors.
 */
export function getBeadTangentArcPx(dim: BeadSlotDimensions): number {
  return Math.max(dim.width, dim.height);
}

export function getBeadImageUrl(bead: PlacedBead | null): string | null {
  if (!bead) return null;
  const url = getBeadDisplayImageUrl(bead.bead);
  if (!url) return null;
  return url.startsWith("data:") ? url : `${url}?v=2`;
}

/** Strand bead image — fills the crop-tight wrapper with no letterboxing. */
export function getStrandBeadImageStyle(bead: BeadLibraryEntry | null | undefined): CSSProperties {
  const visual = resolveBeadVisualBoundsNorm(bead);
  return {
    width: "100%",
    height: "100%",
    objectFit: "fill",
    objectPosition: `${(visual.centerX * 100).toFixed(2)}% ${(visual.centerY * 100).toFixed(2)}%`,
    display: "block",
    background: "transparent",
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
    background: "transparent",
    border: hasImage ? "none" : "1px solid hsl(var(--border) / 0.5)",
    borderRadius: hasImage ? 0 : 4,
    boxShadow: "none",
    overflow: "hidden",
    padding: 0,
    margin: 0,
  };
}

/** Strand beads render flat — no drop-shadow or glow. */
export function getPlacedBeadImageFilter(): CSSProperties["filter"] {
  return undefined;
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
