import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import { resolveAssetImageUrl, withAssetCacheBuster } from "@/lib/asset-image-url";

import {
  beadDisplayImageStyles,
  hasDistinctProcessedAsset,
  resolveBeadDeliveryUrl,
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
  if (strand) return resolveAssetImageUrl(strand, "full") ?? strand;
  return resolveBeadDeliveryUrl(bead, "full");
}

export function getBeadImageUrl(
  bead: PlacedBead | null,
  catalogue?: BeadSlotSizingCatalogueContext,
): string | null {
  if (!bead) return null;
  const profile = resolveStrandRenderProfile(bead.bead, catalogue);

  // Runtime: one canonical processed asset — use full delivery URL to preserve alpha and crop pixels.
  const url = profile.preferStrandImageUrl
    ? resolveStrandImageUrl(bead.bead)
    : resolveBeadDeliveryUrl(bead.bead, "full");
  if (!url) return null;

  const cacheToken = bead.bead.cropConfig?.updatedAt
    ? String(bead.bead.cropConfig.updatedAt)
    : "2";
  return url.startsWith("data:") ? url : withAssetCacheBuster(url, cacheToken);
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

    const base: CSSProperties = {
      position: "absolute",
      left: off.left,
      top: off.top,
      width: img.width,
      height: img.height,
      maxWidth: "none",
      maxHeight: "none",
      display: "block",
      background: "transparent",
      pointerEvents: "none",
      userSelect: "none",
    };

    if (usesProcessedLayer || sizing.sizingPath === "normalizedVisibleDiameter") {
      return base;
    }

    const visual = resolveBeadVisualBoundsNorm(bead);
    return {
      ...base,
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
