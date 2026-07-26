import type { GlassSheetCropRect } from "@bino-foundry/shared/types";
import type { LensPathBounds } from "./glass-material-filter";

export interface GlassSheetPlacement {
  /** Destination rect inside the plate (lens space). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Crop viewBox in natural sheet pixels. */
  viewBox: { x: number; y: number; width: number; height: number };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

/** Resolve crop to natural-pixel viewBox; full image when crop is null. */
export function resolveGlassSheetViewBox(
  naturalWidth: number,
  naturalHeight: number,
  crop: GlassSheetCropRect | null | undefined,
): { x: number; y: number; width: number; height: number } {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  if (!crop) {
    return { x: 0, y: 0, width: nw, height: nh };
  }
  const width = Math.max(1, clamp01(crop.width) * nw);
  const height = Math.max(1, clamp01(crop.height) * nh);
  const x = Math.min(Math.max(0, clamp01(crop.x) * nw), nw - width);
  const y = Math.min(Math.max(0, clamp01(crop.y) * nh), nh - height);
  return { x, y, width, height };
}

/**
 * Fit a cropped sheet into a lens bounding box (cover/contain), then apply scale + offset.
 * Matches `drawCover` / contain behaviour from `lens-sheet-swap.html`.
 */
export function computeGlassSheetPlacement(params: {
  bounds: LensPathBounds;
  naturalWidth: number;
  naturalHeight: number;
  crop?: GlassSheetCropRect | null;
  fit?: "cover" | "contain";
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}): GlassSheetPlacement {
  const {
    bounds,
    naturalWidth,
    naturalHeight,
    crop = null,
    fit = "cover",
    scale = 1,
    offsetX = 0,
    offsetY = 0,
  } = params;

  const viewBox = resolveGlassSheetViewBox(naturalWidth, naturalHeight, crop);
  const ir = viewBox.width / Math.max(1e-6, viewBox.height);
  const pad = 4;
  const targetX = bounds.minX - pad;
  const targetY = bounds.minY - pad;
  const targetW = bounds.width + pad * 2;
  const targetH = bounds.height + pad * 2;
  const tr = targetW / Math.max(1e-6, targetH);

  let dw: number;
  let dh: number;
  if (fit === "contain") {
    if (ir > tr) {
      dw = targetW;
      dh = targetW / ir;
    } else {
      dh = targetH;
      dw = targetH * ir;
    }
  } else if (ir > tr) {
    dh = targetH;
    dw = targetH * ir;
  } else {
    dw = targetW;
    dh = targetW / ir;
  }

  const s = Math.max(0.25, Math.min(3, Number.isFinite(scale) ? scale : 1));
  dw *= s;
  dh *= s;

  const ox = ((Number.isFinite(offsetX) ? offsetX : 0) / 100) * bounds.width;
  const oy = ((Number.isFinite(offsetY) ? offsetY : 0) / 100) * bounds.height;

  return {
    x: targetX + (targetW - dw) / 2 + ox,
    y: targetY + (targetH - dh) / 2 + oy,
    width: dw,
    height: dh,
    viewBox,
  };
}
