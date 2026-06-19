import { loadImage } from "@/render/bead-crop/image-loader";
import { createCanvas } from "@/render/engine/canvas/lens-compositor";

import {
  detectContentBoundsFromRgba,
  type ImageContentBounds,
} from "./content-bounds";

export interface TrimmedPlateResult {
  blob: Blob;
  width: number;
  height: number;
  trimmed: boolean;
  bounds: ImageContentBounds;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to export trimmed plate"))),
      "image/png",
    );
  });
}

function fileNameForTrimmedPlate(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "frame-plate";
  return `${base}-trimmed.png`;
}

/**
 * Trim transparent or bright margins from a plate image.
 * Exports PNG to preserve alpha — same philosophy as bead crop export.
 */
export async function trimPlateImageFromSource(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<TrimmedPlateResult> {
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid plate dimensions");
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  const bounds = detectContentBoundsFromRgba(data, width, height, { paddingPx: 4 });

  const fullBounds: ImageContentBounds = { x: 0, y: 0, width, height };
  const unchanged =
    !bounds ||
    (bounds.x <= 1 &&
      bounds.y <= 1 &&
      bounds.width >= width - 2 &&
      bounds.height >= height - 2);

  if (unchanged) {
    const blob = await canvasToPngBlob(canvas);
    return { blob, width, height, trimmed: false, bounds: bounds ?? fullBounds };
  }

  const trimmed = createCanvas(bounds.width, bounds.height);
  const tctx = trimmed.getContext("2d");
  if (!tctx) throw new Error("Canvas not supported");
  tctx.clearRect(0, 0, bounds.width, bounds.height);
  tctx.drawImage(
    canvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  const blob = await canvasToPngBlob(trimmed);
  return { blob, width: bounds.width, height: bounds.height, trimmed: true, bounds };
}

/** Crop plate to explicit pixel bounds (manual crop). */
export async function cropPlateImageFromBounds(
  source: HTMLImageElement | HTMLCanvasElement,
  bounds: ImageContentBounds,
): Promise<TrimmedPlateResult> {
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (width <= 0 || height <= 0) throw new Error("Invalid plate dimensions");

  const x = Math.max(0, Math.min(bounds.x, width - 1));
  const y = Math.max(0, Math.min(bounds.y, height - 1));
  const cropW = Math.max(1, Math.min(bounds.width, width - x));
  const cropH = Math.max(1, Math.min(bounds.height, height - y));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0);

  const cropped = createCanvas(cropW, cropH);
  const cctx = cropped.getContext("2d");
  if (!cctx) throw new Error("Canvas not supported");
  cctx.drawImage(canvas, x, y, cropW, cropH, 0, 0, cropW, cropH);

  const blob = await canvasToPngBlob(cropped);
  return {
    blob,
    width: cropW,
    height: cropH,
    trimmed: x > 0 || y > 0 || cropW < width || cropH < height,
    bounds: { x, y, width: cropW, height: cropH },
  };
}

export async function cropPlateImageUrl(
  url: string,
  bounds: ImageContentBounds,
): Promise<TrimmedPlateResult> {
  const img = await loadImage(url);
  return cropPlateImageFromBounds(img, bounds);
}

/** Trim a local file before admin upload. */
export async function trimPlateImageFile(file: File): Promise<TrimmedPlateResult & { file: File }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const result = await trimPlateImageFromSource(img);
    const uploadFile = new File([result.blob], fileNameForTrimmedPlate(file.name), {
      type: "image/png",
    });
    return { ...result, file: uploadFile };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Trim an already-hosted plate URL (re-upload flow). */
export async function trimPlateImageUrl(url: string): Promise<TrimmedPlateResult> {
  const img = await loadImage(url);
  return trimPlateImageFromSource(img);
}
