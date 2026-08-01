import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import { withAssetCacheBuster } from "@/lib/asset-image-url";
import {
  beadDisplayImageStyles,
  beadImageCacheToken,
  hasDistinctProcessedAsset,
  resolveStrandDeliveryUrl,
} from "./apply-crop";
import { resolveBeadVisualBoundsNorm } from "./crop-visual-bounds";
import {
  resolveBeadSlotSizing,
  type BeadSlotDimensions,
  type BeadSlotSizingCatalogueContext,
  type BeadSlotSizingResult,
} from "./strand-bead-sizing";
import { resolveStrandRenderProfile } from "./strand-render-profile";
import { layoutDiameterPxForMm } from "./canonical-strand-mm-scale";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";

export type { BeadSlotDimensions, BeadSlotSizingCatalogueContext };

export { STRAND_CORD };

export const STRAND_BEAD_VISUAL_SCALE = 1;

export function mmToBasePx(sizeMm: number, scaleFactor: number): number {
  return layoutDiameterPxForMm(sizeMm, scaleFactor) * STRAND_BEAD_VISUAL_SCALE;
}

export function getBeadSlotDimensions(
  bead: PlacedBead | null,
  beadSize: BeadSize,
  scaleFactor: number,
  catalogue?: BeadSlotSizingCatalogueContext,
): BeadSlotDimensions {
  return resolveBeadSlotSizing(bead, beadSize, scaleFactor, catalogue).dimensions;
}

export function beadTargetDiameterPx(beadSize: BeadSize, scaleFactor: number): number {
  return mmToBasePx(beadSize, scaleFactor);
}

export function getMaxSlotExtent(slots: { width: number; height: number }[]): number {
  if (!slots.length) return mmToBasePx(8, 1);
  return Math.max(...slots.map((s) => Math.max(s.width, s.height)));
}

/** Tangential extent along the strand (slot width at the anchor). */
export function getBeadTangentArcPx(dim: BeadSlotDimensions): number {
  return dim.width;
}

function resolveStrandImageUrl(bead: BeadLibraryEntry): string | null {
  const meta = bead.metadata as { strandImageUrl?: string; strandImage?: string } | undefined;
  const strand = meta?.strandImageUrl?.trim() || meta?.strandImage?.trim();
  if (strand) return strand;
  return resolveStrandDeliveryUrl(bead);
}

export function getBeadImageUrl(
  bead: PlacedBead | null,
  catalogue?: BeadSlotSizingCatalogueContext,
): string | null {
  if (!bead) return null;
  const profile = resolveStrandRenderProfile(bead.bead, catalogue);

  // Runtime: one canonical processed asset per bead — mm scaling is via wrapper only.
  const url = profile.preferStrandImageUrl
    ? resolveStrandImageUrl(bead.bead)
    : resolveStrandDeliveryUrl(bead.bead);
  if (!url) return null;

  return url.startsWith("data:") ? url : withAssetCacheBuster(url, beadImageCacheToken(bead.bead));
}

/** Library sidebar — proportional fit of the same processed asset as the strand builder. */
export function getBeadLibraryThumbnailStyle(
  bead: BeadLibraryEntry | null | undefined,
): CSSProperties {
  if (!bead) {
    return { objectFit: "contain", background: "transparent" };
  }

  const base: CSSProperties = {
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
    width: "auto",
    height: "auto",
    objectFit: "contain",
    objectPosition: "center center",
    background: "transparent",
  };

  if (hasDistinctProcessedAsset(bead)) return base;

  return { ...base, ...beadDisplayImageStyles(bead) };
}

/** Strand bead image — uniform scale inside mm wrapper; never stretch or squash. */
export function getStrandBeadImageStyle(
  bead: BeadLibraryEntry | null | undefined,
  sizing?: Pick<
    BeadSlotSizingResult,
    | "usesProcessedCanvas"
    | "usesClipPath"
    | "sizingPath"
    | "imageDimensions"
    | "imageOffsetPx"
  > | null,
): CSSProperties {
  if (sizing?.imageDimensions) {
    const img = sizing.imageDimensions;
    const off = sizing.imageOffsetPx;
    const usesProcessedLayer =
      sizing.usesProcessedCanvas ?? hasDistinctProcessedAsset(bead);

    if (usesProcessedLayer || sizing.sizingPath === "normalizedVisibleDiameter") {
      return {
        position: "absolute",
        left: off.left,
        top: off.top,
        width: img.width,
        height: img.height,
        display: "block",
        objectFit: "contain",
        objectPosition: "center center",
        background: "transparent",
      };
    }

    const visual = resolveBeadVisualBoundsNorm(bead);
    return {
      position: "absolute",
      left: off.left,
      top: off.top,
      width: img.width,
      height: img.height,
      display: "block",
      objectFit: "contain",
      background: "transparent",
      objectPosition: `${(visual.centerX * 100).toFixed(2)}% ${(visual.centerY * 100).toFixed(2)}%`,
      ...beadDisplayImageStyles(bead ?? undefined),
    };
  }

  return {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
    background: "transparent",
    ...beadDisplayImageStyles(bead ?? undefined),
  };
}

/**
 * Apply hierarchical resolvedRenderScale to image layout only.
 * Slot/occupancy dimensions stay on physical mm sizing.
 */
export function scaleBeadSlotSizingForRenderScale<
  T extends {
    imageDimensions: BeadSlotDimensions;
    imageOffsetPx: { left: number; top: number };
  },
>(sizing: T, renderScale: number): T {
  if (!Number.isFinite(renderScale) || renderScale <= 0 || renderScale === 1) return sizing;
  return {
    ...sizing,
    imageDimensions: {
      width: sizing.imageDimensions.width * renderScale,
      height: sizing.imageDimensions.height * renderScale,
    },
    imageOffsetPx: {
      left: sizing.imageOffsetPx.left * renderScale,
      top: sizing.imageOffsetPx.top * renderScale,
    },
  };
}

export function usesProcessedStrandAsset(bead: BeadLibraryEntry | null | undefined): boolean {
  return hasDistinctProcessedAsset(bead);
}

export function getGuideSlotDimensions(scaleFactor: number, beadSizeMm = 8): BeadSlotDimensions {
  const base = mmToBasePx(beadSizeMm, scaleFactor) * 0.94;
  return { width: base, height: base };
}

const STRAND_CORD = {
  stroke: "hsl(var(--strand-cord) / 0.55)",
  strokeDrag: "hsl(var(--strand-cord-active) / 0.65)",
  widthFactor: 3.4,
  opacity: 0.92,
} as const;

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

export function getEmptySlotShellStyle(dim: BeadSlotDimensions): CSSProperties {
  return getPartialEmptySlotShellStyle(dim);
}

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
    overflow: "visible",
    padding: 0,
    margin: 0,
  };
}

export function getPlacedBeadImageFilter(): CSSProperties["filter"] {
  return undefined;
}

/** Layout is CSS-only — avoid HTML width/height attrs that default to object-fit: fill. */
export function getStrandBeadRasterSize(
  _dim: BeadSlotDimensions,
): Record<string, never> {
  return {};
}
