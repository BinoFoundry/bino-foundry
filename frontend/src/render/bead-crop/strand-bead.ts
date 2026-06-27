import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import { resolveAssetImageUrl, withAssetCacheBuster } from "@/lib/asset-image-url";

import {
  beadDisplayImageStyles,
  hasDistinctProcessedAsset,
  mergeSizeOfferFromCatalogue,
  resolveBeadDeliveryUrl,
  resolvePreNormalizedDeliveryUrl,
} from "./apply-crop";
import { resolveBeadVisualBoundsNorm } from "./crop-visual-bounds";
import {
  resolveBeadSlotSizing,
  type BeadSlotDimensions,
  type BeadSlotSizingCatalogueContext,
  type BeadSlotSizingResult,
} from "./strand-bead-sizing";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";

export type { BeadSlotDimensions, BeadSlotSizingCatalogueContext };

const STRAND_IMAGE_TYPE_SLUGS = new Set(["spacer", "separator", "connector"]);

export const STRAND_BEAD_VISUAL_SCALE = 1;

export function mmToBasePx(sizeMm: number, scaleFactor: number): number {
  return calibratedVisualDiameterPx(sizeMm) * scaleFactor * STRAND_BEAD_VISUAL_SCALE;
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

export function getBeadTangentArcPx(dim: BeadSlotDimensions): number {
  return Math.max(dim.width, dim.height);
}

function resolveStrandImageUrl(bead: BeadLibraryEntry): string | null {
  const meta = bead.metadata as { strandImageUrl?: string; strandImage?: string } | undefined;
  const strand = meta?.strandImageUrl?.trim() || meta?.strandImage?.trim();
  if (strand) return resolveAssetImageUrl(strand, "medium") ?? strand;
  return resolveBeadDeliveryUrl(bead, "medium");
}

export function getBeadImageUrl(
  bead: PlacedBead | null,
  catalogue?: BeadSlotSizingCatalogueContext,
): string | null {
  if (!bead) return null;
  const slug = bead.bead.beadTypeSlug ?? "crystal";
  const mergedOffer = mergeSizeOfferFromCatalogue(bead.size, catalogue, bead.bead.id);

  const normalized = resolvePreNormalizedDeliveryUrl(mergedOffer, "full", catalogue);
  if (normalized) {
    const cacheToken = mergedOffer?.updatedAt
      ? String(Date.parse(mergedOffer.updatedAt) || mergedOffer.updatedAt)
      : bead.bead.cropConfig?.updatedAt
        ? String(bead.bead.cropConfig.updatedAt)
        : "2";
    return normalized.startsWith("data:")
      ? normalized
      : withAssetCacheBuster(normalized, cacheToken);
  }

  const url = STRAND_IMAGE_TYPE_SLUGS.has(slug)
    ? resolveStrandImageUrl(bead.bead)
    : resolveBeadDeliveryUrl(bead.bead, "medium");
  if (!url) return null;

  const cacheToken = bead.bead.cropConfig?.updatedAt
    ? String(bead.bead.cropConfig.updatedAt)
    : "2";
  return url.startsWith("data:") ? url : withAssetCacheBuster(url, cacheToken);
}

/** Strand bead image — display the saved bitmap exactly (no object-fit or clip). */
export function getStrandBeadImageStyle(
  bead: BeadLibraryEntry | null | undefined,
  sizing?: Pick<
    BeadSlotSizingResult,
    "usesProcessedCanvas" | "usesClipPath" | "sizingPath"
  > | null,
): CSSProperties {
  if (sizing?.sizingPath === "normalizedVisibleDiameter") {
    return {
      width: "100%",
      height: "100%",
      display: "block",
      maxWidth: "none",
      maxHeight: "none",
      objectFit: "fill",
      background: "transparent",
    };
  }

  const usesProcessedLayer =
    sizing?.usesProcessedCanvas ?? hasDistinctProcessedAsset(bead);

  if (usesProcessedLayer) {
    return {
      width: "100%",
      height: "100%",
      display: "block",
      background: "transparent",
    };
  }

  const visual = resolveBeadVisualBoundsNorm(bead);
  return {
    width: "100%",
    height: "100%",
    display: "block",
    objectPosition: `${(visual.centerX * 100).toFixed(2)}% ${(visual.centerY * 100).toFixed(2)}%`,
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

export const STRAND_CORD = {
  stroke: "hsl(var(--strand-cord) / 0.55)",
  strokeDrag: "hsl(var(--strand-cord-active) / 0.65)",
  widthFactor: 3.4,
  opacity: 0.92,
  opacityComplete: 0.55,
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
