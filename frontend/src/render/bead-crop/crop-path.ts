import {
  BEAD_CROP_CONFIG_V1,
  BEAD_CROP_CONFIG_V2,
  beadCropRectToPathAnchors,
  createBeadCropConfigV2,
  getBeadCropPoints,
  migrateBeadAnchors,
  type BeadCropConfig,
  type BeadPathAnchor,
} from "@bino-foundry/shared/types";
import { createCanvas } from "@/render/engine/canvas/lens-compositor";
import {
  createLensPolygon,
  migrateAnchors,
  type LensPolygon,
  type PathAnchor,
} from "@/render/mask/mask-types";
import { pathsToMaskCanvas, traceLensPath } from "@/render/mask/bezier-path";

import { loadImage } from "./image-loader";

const CROP_PATH_ID = "crop";

export function defaultBeadCropLens(): LensPolygon[] {
  return [createLensPolygon(CROP_PATH_ID, "Crop boundary", [])];
}

export function beadCropConfigToEditorLenses(config: BeadCropConfig | null | undefined): LensPolygon[] {
  const points = getBeadCropPoints(config);
  if (points.length) {
    return [
      createLensPolygon(
        CROP_PATH_ID,
        "Crop boundary",
        migrateAnchors(points as PathAnchor[]),
      ),
    ];
  }
  return defaultBeadCropLens();
}

export function editorLensesToBeadCropConfig(
  imageWidth: number,
  imageHeight: number,
  originalUrl: string,
  lenses: LensPolygon[],
  options?: { processedUrl?: string; scale?: number },
): BeadCropConfig {
  const lens = lenses.find((l) => l.id === CROP_PATH_ID) ?? lenses[0];
  const points = migrateBeadAnchors((lens?.points ?? []) as BeadPathAnchor[]);
  return createBeadCropConfigV2(imageWidth, imageHeight, originalUrl, points, options);
}

/** Tight pixel bounds of filled crop mask. */
export function pathMaskBounds(
  width: number,
  height: number,
  points: BeadPathAnchor[],
): { x: number; y: number; width: number; height: number } | null {
  const lens = createLensPolygon(CROP_PATH_ID, "Crop", migrateAnchors(points as PathAnchor[]));
  if (migrateAnchors(lens.points).length < 3) return null;

  const mask = pathsToMaskCanvas(width, height, [lens]);
  const ctx = mask.getContext("2d");
  if (!ctx) return null;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;
      if (alpha > 8) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Export render-ready PNG: original image clipped to path, centered on square canvas.
 */
export async function exportCroppedBeadBlob(
  config: BeadCropConfig,
  mime: "image/png" | "image/webp" = "image/png",
): Promise<Blob> {
  const img = await loadImage(config.originalUrl);
  const w = config.imageWidth || img.naturalWidth;
  const h = config.imageHeight || img.naturalHeight;

  let points = getBeadCropPoints(config);
  if (config.version === BEAD_CROP_CONFIG_V1 && config.crop) {
    points = beadCropRectToPathAnchors(config.crop);
  }
  if (points.length < 3) {
    throw new Error("Crop path needs at least 3 points");
  }

  const lens = createLensPolygon(CROP_PATH_ID, "Crop", migrateAnchors(points as PathAnchor[]));
  const bounds = pathMaskBounds(w, h, points);
  if (!bounds) throw new Error("Could not compute crop bounds");

  const pad = Math.round(Math.max(bounds.width, bounds.height) * 0.06);
  const side = Math.max(bounds.width, bounds.height) + pad * 2;
  const out = createCanvas(side, side);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const offsetX = pad + (side - pad * 2 - bounds.width) / 2 - bounds.x;
  const offsetY = pad + (side - pad * 2 - bounds.height) / 2 - bounds.y;

  ctx.clearRect(0, 0, side, side);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.beginPath();
  traceLensPath(ctx, lens, w, h, true);
  ctx.clip();
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();

  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to export crop"))),
      mime,
      0.92,
    );
  });
}

export function beadCropPathToPreviewCanvas(
  config: BeadCropConfig,
  maxW = 200,
  maxH = 80,
): HTMLCanvasElement | null {
  const w = config.imageWidth;
  const h = config.imageHeight;
  const points = getBeadCropPoints(config);
  if (!w || !h || points.length < 3) return null;

  const lens = createLensPolygon(CROP_PATH_ID, "Crop", migrateAnchors(points as PathAnchor[]));
  const mask = pathsToMaskCanvas(w, h, [lens]);
  const thumb = createCanvas(maxW, maxH);
  const ctx = thumb.getContext("2d");
  if (!ctx) return null;
  const scale = Math.min(maxW / w, maxH / h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, maxW, maxH);
  ctx.drawImage(mask, 0, 0, w, h, 0, 0, w * scale, h * scale);
  return thumb;
}

export function isBeadCropEditorValid(lenses: LensPolygon[]): boolean {
  const lens = lenses.find((l) => l.id === CROP_PATH_ID) ?? lenses[0];
  return migrateAnchors(lens?.points ?? []).length >= 3;
}

export function upgradeBeadCropOnSave(
  config: BeadCropConfig | null,
  lenses: LensPolygon[],
  imgW: number,
  imgH: number,
  originalUrl: string,
): BeadCropConfig {
  if (config?.version === BEAD_CROP_CONFIG_V2) {
    return editorLensesToBeadCropConfig(imgW, imgH, originalUrl, lenses, {
      processedUrl: config.processedUrl,
      scale: config.scale,
    });
  }
  return editorLensesToBeadCropConfig(imgW, imgH, originalUrl, lenses, {
    processedUrl: config?.version === BEAD_CROP_CONFIG_V1 ? config.processedUrl : undefined,
    scale: config?.version === BEAD_CROP_CONFIG_V1 ? config.scale : 1,
  });
}
