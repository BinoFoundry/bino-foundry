import {
  BEAD_CROP_CONFIG_V1,
  getBeadCropPoints,
  type BeadCropConfig,
  type BeadPathAnchor,
} from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

import { hasDistinctProcessedAsset } from "./apply-crop";
import { pathMaskBounds } from "./crop-path";

/** Normalized visible silhouette of a bead crop (0–1 relative to source image). */
export interface BeadVisualBoundsNorm {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

const UNIT_BOUNDS: BeadVisualBoundsNorm = {
  width: 1,
  height: 1,
  centerX: 0.5,
  centerY: 0.5,
};

function boundsFromAnchorPoints(points: BeadPathAnchor[]): BeadVisualBoundsNorm | null {
  if (points.length < 3) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return null;
  return {
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

function boundsFromMask(
  imageWidth: number,
  imageHeight: number,
  points: BeadPathAnchor[],
): BeadVisualBoundsNorm | null {
  try {
    const bounds = pathMaskBounds(imageWidth, imageHeight, points);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      width: bounds.width / imageWidth,
      height: bounds.height / imageHeight,
      centerX: (bounds.x + bounds.width / 2) / imageWidth,
      centerY: (bounds.y + bounds.height / 2) / imageHeight,
    };
  } catch {
    return boundsFromAnchorPoints(points);
  }
}

/** Tight mask bounds from crop config, normalized to image dimensions. */
export function beadVisualBoundsFromCropConfig(
  config: BeadCropConfig | null | undefined,
): BeadVisualBoundsNorm {
  if (!config) return UNIT_BOUNDS;

  const imageWidth = config.imageWidth;
  const imageHeight = config.imageHeight;
  if (!imageWidth || !imageHeight) return UNIT_BOUNDS;

  if (config.version === BEAD_CROP_CONFIG_V1 && config.crop) {
    const { x, y, width, height } = config.crop;
    if (width <= 0 || height <= 0) return UNIT_BOUNDS;
    return {
      width: width,
      height: height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  }

  const points = getBeadCropPoints(config);
  if (points.length < 3) return UNIT_BOUNDS;

  return boundsFromMask(imageWidth, imageHeight, points) ?? boundsFromAnchorPoints(points) ?? UNIT_BOUNDS;
}

export function resolveBeadVisualBoundsNorm(
  bead: BeadLibraryEntry | null | undefined,
): BeadVisualBoundsNorm {
  return beadVisualBoundsFromCropConfig(bead?.cropConfig ?? null);
}

/** True when strand displays a distinct processed export asset. */
export function usesProcessedVisualBounds(bead: BeadLibraryEntry | null | undefined): boolean {
  return hasDistinctProcessedAsset(bead);
}
