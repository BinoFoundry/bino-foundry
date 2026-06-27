import {
  BEAD_CROP_CONFIG_V1,
  BEAD_CROP_CONFIG_V2,
  beadCropRectToPathAnchors,
  createBeadCropConfigV2,
  getBeadCropPoints,
  migrateBeadAnchors,
  resolveBeadPhysicalMetrics,
  resolveBeadVisibleDiameterPx,
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

import { defringeCanvas } from "./defringe";
import { loadImageForProcessing } from "./image-loader";
import type { BeadDeliveryUrls } from "@bino-foundry/shared/types";
import {
  deriveBeadPhysicalMetrics,
  computeCropOccupancyMetrics,
  capExportCanvasDimensions,
  BEAD_NORMALIZED_EXPORT_MAX_CANVAS_PX,
  normalizedExportDiameterMatchesTarget,
  type BeadCropPhysicalMetrics,
  type BeadVisualBoundsStored,
} from "@bino-foundry/shared/types";

const CROP_PATH_ID = "crop";

export function defaultBeadCropLens(): LensPolygon[] {
  return [createLensPolygon(CROP_PATH_ID, "Crop boundary", [])];
}

/** Always return the single crop-path slot (same idea as ensureFrameLensSet for frames). */
export function ensureBeadCropLens(lenses: LensPolygon[]): LensPolygon[] {
  const def = defaultBeadCropLens()[0];
  const existing = lenses.find((l) => l.id === CROP_PATH_ID) ?? lenses[0];
  if (!existing) return defaultBeadCropLens();
  return [
    {
      id: CROP_PATH_ID,
      label: existing.label || def.label,
      points: migrateAnchors(existing.points),
    },
  ];
}

export function beadCropConfigToEditorLenses(config: BeadCropConfig | null | undefined): LensPolygon[] {
  const points = getBeadCropPoints(config);
  if (points.length) {
    return ensureBeadCropLens([
      createLensPolygon(
        CROP_PATH_ID,
        "Crop boundary",
        migrateAnchors(points as PathAnchor[]),
      ),
    ]);
  }
  return defaultBeadCropLens();
}

/** Stable editor mount key — must not include updatedAt. */
export function beadCropEditorPlateKey(originalUrl: string, config?: BeadCropConfig | null): string {
  const w = config?.imageWidth ?? 0;
  const h = config?.imageHeight ?? 0;
  return `${originalUrl.trim()}|${w}x${h}`;
}

export function editorLensesToBeadCropConfig(
  imageWidth: number,
  imageHeight: number,
  originalUrl: string,
  lenses: LensPolygon[],
  options?: Partial<
    Pick<
      import("@bino-foundry/shared/types").BeadCropConfigV2,
      "processedUrl" | "scale" | "detection" | "visualBounds" | "physicalMetrics"
    >
  >,
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

export interface CanvasVisibleFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
  diameterPx: number;
}

/** Alpha scan of a rendered export — authoritative visible silhouette size. */
export function measureCanvasVisibleFootprint(canvas: HTMLCanvasElement): CanvasVisibleFootprint | null {
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return null;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3] ?? 0;
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
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  return {
    x: minX,
    y: minY,
    width,
    height,
    diameterPx: Math.max(width, height),
  };
}

function resolveAssetVisibleDiameterPx(config: BeadCropConfig, maskMaxEdgePx: number): number {
  const resolution = resolveBeadPhysicalMetrics(config);
  const fromMetrics = resolveBeadVisibleDiameterPx(resolution?.metrics);
  if (fromMetrics > 0) return fromMetrics;

  const points = getBeadCropPoints(config);
  const computed = computeBeadPhysicalMetricsForSave(config.imageWidth, config.imageHeight, points);
  const fromComputed = resolveBeadVisibleDiameterPx(computed);
  if (fromComputed > 0) return fromComputed;

  return maskMaxEdgePx;
}

/** Standard square canvas side for every bead in a mm group (visible + uniform pad). */
export function normalizedExportCanvasSidePx(
  targetVisibleDiameterPx: number,
  padFraction = 0.04,
): number {
  const pad = Math.max(1, Math.round(targetVisibleDiameterPx * padFraction));
  return targetVisibleDiameterPx + pad * 2;
}

/** Place scaled silhouette on a fixed group canvas — all same-mm exports share dimensions. */
function composeNormalizedExportOnGroupCanvas(
  source: HTMLCanvasElement,
  targetVisibleDiameterPx: number,
  padFraction = 0.04,
): { canvas: HTMLCanvasElement; footprint: CanvasVisibleFootprint } {
  const footprint = measureCanvasVisibleFootprint(source);
  if (!footprint) {
    throw new Error("Normalized export produced an empty canvas");
  }

  const side = normalizedExportCanvasSidePx(targetVisibleDiameterPx, padFraction);
  const fixed = createCanvas(side, side);
  const ctx = fixed.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const scale = targetVisibleDiameterPx / footprint.diameterPx;
  const destW = footprint.width * scale;
  const destH = footprint.height * scale;
  const destX = (side - destW) / 2;
  const destY = (side - destH) / 2;

  ctx.clearRect(0, 0, side, side);
  ctx.drawImage(
    source,
    footprint.x,
    footprint.y,
    footprint.width,
    footprint.height,
    destX,
    destY,
    destW,
    destH,
  );
  defringeCanvas(ctx, side, side);

  const finalFootprint = measureCanvasVisibleFootprint(fixed);
  if (!finalFootprint) {
    throw new Error("Fixed canvas compose produced an empty canvas");
  }

  return { canvas: fixed, footprint: finalFootprint };
}

/** Predict processed PNG canvas size from visible mask bounds (matches exportCroppedBeadBlob). */
export function computeProcessedExportDimensions(mask: {
  width: number;
  height: number;
}): { processedWidthPx: number; processedHeightPx: number } {
  const pad = Math.round(Math.max(mask.width, mask.height) * 0.04);
  return {
    processedWidthPx: mask.width + pad * 2,
    processedHeightPx: mask.height + pad * 2,
  };
}

/** Save-time only — visible bounds metadata for mm-based rendering. */
export function computeBeadPhysicalMetricsForSave(
  imageWidth: number,
  imageHeight: number,
  points: BeadPathAnchor[],
  options?: { includeProcessedDimensions?: boolean },
): BeadCropPhysicalMetrics | undefined {
  if (!imageWidth || !imageHeight || points.length < 3) return undefined;

  const mask = pathMaskBounds(imageWidth, imageHeight, points);
  if (mask && mask.width > 0 && mask.height > 0) {
    const processed =
      options?.includeProcessedDimensions !== false
        ? computeProcessedExportDimensions(mask)
        : undefined;
    const occupancy =
      processed?.processedWidthPx && processed?.processedHeightPx
        ? computeCropOccupancyMetrics(
            points,
            imageWidth,
            imageHeight,
            processed.processedWidthPx,
            processed.processedHeightPx,
            mask,
          )
        : null;
    return {
      visibleWidthPx: mask.width,
      visibleHeightPx: mask.height,
      referenceDiameterPx: Math.max(mask.width, mask.height),
      visibleDiameterPx: Math.max(mask.width, mask.height),
      processedWidthPx: processed?.processedWidthPx,
      processedHeightPx: processed?.processedHeightPx,
      polygonBoundingWidthPx: occupancy?.polygonBoundingWidthPx,
      polygonBoundingHeightPx: occupancy?.polygonBoundingHeightPx,
      polygonDiameterPx: occupancy?.polygonDiameterPx,
      occupancyRatio: occupancy?.occupancyRatio,
    };
  }

  const derived = deriveBeadPhysicalMetrics({
    version: 2,
    imageWidth,
    imageHeight,
    originalUrl: "",
    points,
    scale: 1,
  });
  return derived ?? undefined;
}

/** Save-time only — silhouette bounds for clip / object-position. */
export function computeBeadVisualBoundsForSave(
  imageWidth: number,
  imageHeight: number,
  points: BeadPathAnchor[],
): BeadVisualBoundsStored | undefined {
  const metrics = computeBeadPhysicalMetricsForSave(imageWidth, imageHeight, points);
  if (!metrics) return undefined;

  const mask = pathMaskBounds(imageWidth, imageHeight, points);
  if (mask) {
    return {
      width: metrics.visibleWidthPx / imageWidth,
      height: metrics.visibleHeightPx / imageHeight,
      centerX: (mask.x + mask.width / 2) / imageWidth,
      centerY: (mask.y + mask.height / 2) / imageHeight,
    };
  }

  return {
    width: metrics.visibleWidthPx / imageWidth,
    height: metrics.visibleHeightPx / imageHeight,
    centerX: 0.5,
    centerY: 0.5,
  };
}

/**
 * Render cropped bead to canvas — single pass used by all export formats.
 */
async function renderCroppedBeadCanvas(
  config: BeadCropConfig,
  options?: { targetVisibleDiameterPx?: number; maxCanvasEdge?: number; skipCanvasCap?: boolean },
): Promise<{
  canvas: HTMLCanvasElement;
  bakedVisibleDiameterPx: number;
  measuredVisibleDiameterPx: number;
  assetVisibleDiameterPx: number;
  normalizationScale: number;
  canvasSizeBeforeScale: { width: number; height: number };
  canvasSizeAfterScale: { width: number; height: number };
  footprintBeforeScale: { width: number; height: number; diameterPx: number };
  footprintAfterScale: CanvasVisibleFootprint;
}> {
  const img = await loadImageForProcessing(config.originalUrl);
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

  const maskMaxEdge = Math.max(bounds.width, bounds.height);
  const assetVisibleDiameterPx = resolveAssetVisibleDiameterPx(config, maskMaxEdge);
  const footprintBeforeScale = {
    width: bounds.width,
    height: bounds.height,
    diameterPx: maskMaxEdge,
  };

  const padUnscaled = Math.round(maskMaxEdge * 0.04);
  const canvasSizeBeforeScale = {
    width: Math.ceil(bounds.width + padUnscaled * 2),
    height: Math.ceil(bounds.height + padUnscaled * 2),
  };

  const targetVisible =
    options?.targetVisibleDiameterPx && options.targetVisibleDiameterPx > 0
      ? options.targetVisibleDiameterPx
      : assetVisibleDiameterPx;
  const normalizationScale = targetVisible / assetVisibleDiameterPx;

  const scaledMaskW = bounds.width * normalizationScale;
  const scaledMaskH = bounds.height * normalizationScale;
  const pad = Math.round(Math.max(scaledMaskW, scaledMaskH) * 0.04);
  const rawW = Math.ceil(scaledMaskW + pad * 2);
  const rawH = Math.ceil(scaledMaskH + pad * 2);
  const maxEdge = options?.skipCanvasCap
    ? Number.MAX_SAFE_INTEGER
    : (options?.maxCanvasEdge ?? BEAD_NORMALIZED_EXPORT_MAX_CANVAS_PX);
  const capped = capExportCanvasDimensions(rawW, rawH, maxEdge);
  const outW = capped.width;
  const outH = capped.height;
  const canvasSizeAfterScale = { width: outW, height: outH };
  const out = createCanvas(outW, outH);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const drawScale = normalizationScale * capped.downscale;
  const offsetX = pad * capped.downscale - bounds.x * drawScale;
  const offsetY = pad * capped.downscale - bounds.y * drawScale;

  ctx.clearRect(0, 0, outW, outH);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(drawScale, drawScale);
  ctx.beginPath();
  traceLensPath(ctx, lens, w, h, true);
  ctx.clip();
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  defringeCanvas(ctx, outW, outH);

  const isNormalizedExport =
    options?.targetVisibleDiameterPx != null && options.targetVisibleDiameterPx > 0;
  let exportCanvas = out;
  let footprintAfterScale = measureCanvasVisibleFootprint(out);
  if (!footprintAfterScale) {
    throw new Error("Normalized export produced an empty canvas");
  }

  if (isNormalizedExport) {
    const composed = composeNormalizedExportOnGroupCanvas(
      out,
      options!.targetVisibleDiameterPx!,
    );
    exportCanvas = composed.canvas;
    footprintAfterScale = composed.footprint;
    canvasSizeAfterScale.width = exportCanvas.width;
    canvasSizeAfterScale.height = exportCanvas.height;
  }

  const bakedVisibleDiameterPx = footprintAfterScale.diameterPx;

  if (
    isNormalizedExport &&
    !normalizedExportDiameterMatchesTarget(bakedVisibleDiameterPx, options!.targetVisibleDiameterPx!)
  ) {
    throw new Error(
      `Normalization scale not applied to bitmap: measured ${bakedVisibleDiameterPx.toFixed(1)}px visible, target ${options!.targetVisibleDiameterPx!.toFixed(1)}px (scale ${normalizationScale.toFixed(4)}, asset visible ${assetVisibleDiameterPx.toFixed(1)}px)`,
    );
  }

  return {
    canvas: exportCanvas,
    bakedVisibleDiameterPx,
    measuredVisibleDiameterPx: bakedVisibleDiameterPx,
    assetVisibleDiameterPx,
    normalizationScale,
    canvasSizeBeforeScale,
    canvasSizeAfterScale,
    footprintBeforeScale,
    footprintAfterScale,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: "image/png" | "image/webp" | "image/avif",
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Failed to export ${mime}`))),
      mime,
      quality,
    );
  });
}

/**
 * Export render-ready PNG: original image clipped to path, optional visible-diameter normalization.
 */
export async function exportCroppedBeadBlob(
  config: BeadCropConfig,
  mime: "image/png" | "image/webp" = "image/png",
  options?: { targetVisibleDiameterPx?: number },
): Promise<Blob> {
  const { canvas } = await renderCroppedBeadCanvas(config, options);
  return canvasToBlob(canvas, mime);
}

export interface BeadCropDeliveryBlobs {
  png: Blob;
  webp: Blob;
  avif: Blob | null;
}

export interface NormalizedBeadDeliveryBlobs {
  webp: Blob;
  avif: Blob | null;
  /** Visible silhouette diameter measured on the exported canvas. */
  bakedVisibleDiameterPx: number;
  measuredVisibleDiameterPx: number;
  exportWidthPx: number;
  exportHeightPx: number;
  targetVisibleDiameterPx: number;
  assetVisibleDiameterPx: number;
  normalizationScale: number;
  scaleApplied: boolean;
}

/** WebP-first normalized export — single canvas render, overwrites prior normalized asset. */
export async function exportNormalizedBeadBlobs(
  config: BeadCropConfig,
  options: { targetVisibleDiameterPx: number },
): Promise<NormalizedBeadDeliveryBlobs> {
  const rendered = await renderCroppedBeadCanvas(config, {
    targetVisibleDiameterPx: options.targetVisibleDiameterPx,
    skipCanvasCap: true,
  });
  const { canvas } = rendered;
  const webp = await canvasToBlob(canvas, "image/webp", 0.9);
  let avif: Blob | null = null;
  try {
    avif = await canvasToBlob(canvas, "image/avif", 0.85);
  } catch {
    avif = null;
  }
  const scaleApplied = normalizedExportDiameterMatchesTarget(
    rendered.measuredVisibleDiameterPx,
    options.targetVisibleDiameterPx,
  );
  return {
    webp,
    avif,
    bakedVisibleDiameterPx: rendered.bakedVisibleDiameterPx,
    measuredVisibleDiameterPx: rendered.measuredVisibleDiameterPx,
    exportWidthPx: canvas.width,
    exportHeightPx: canvas.height,
    targetVisibleDiameterPx: options.targetVisibleDiameterPx,
    assetVisibleDiameterPx: rendered.assetVisibleDiameterPx,
    normalizationScale: rendered.normalizationScale,
    scaleApplied,
  };
}

/** Export PNG + WebP (+ AVIF when supported) from the same crop canvas. */
export async function exportCroppedBeadDeliveryBlobs(
  config: BeadCropConfig,
  options?: { targetVisibleDiameterPx?: number },
): Promise<BeadCropDeliveryBlobs> {
  const { canvas } = await renderCroppedBeadCanvas(config, options);
  const [png, webp] = await Promise.all([
    canvasToBlob(canvas, "image/png"),
    canvasToBlob(canvas, "image/webp", 0.9),
  ]);
  let avif: Blob | null = null;
  try {
    avif = await canvasToBlob(canvas, "image/avif", 0.85);
  } catch {
    avif = null;
  }
  return { png, webp, avif };
}

export function deliveryUrlsFromUploads(uploads: {
  png: string;
  webp: string;
  avif?: string | null;
}): BeadDeliveryUrls {
  return {
    png: uploads.png,
    webp: uploads.webp,
    avif: uploads.avif ?? undefined,
  };
}

export interface BitmapExportComparison {
  configuredSizeMm: number;
  groupReferenceDiameterPx: number;
  assetVisibleDiameterPx: number;
  normalizationScale: number;
  /** Processed export (before mm-group normalization). */
  processed: {
    blob: Blob;
    objectUrl: string;
    canvasWidthPx: number;
    canvasHeightPx: number;
    visibleDiameterPx: number;
  };
  /** Normalized export (after mm-group normalization). */
  normalized: {
    blob: Blob;
    objectUrl: string;
    canvasWidthPx: number;
    canvasHeightPx: number;
    visibleDiameterPx: number;
  };
  /** True when measured footprints differ enough to be visible (not metadata-only). */
  bitmapsVisuallyDistinct: boolean;
  /** Footprint diameter ratio normalized / processed. */
  visibleDiameterRatio: number;
  /** All same-mm normalized exports use this canvas side. */
  groupCanvasSidePx: number;
  scaleApplied: boolean;
}

const BITMAP_DISTINCT_MIN_RATIO = 1.02;

/** Render processed + normalized PNGs for side-by-side visual acceptance. */
export async function exportBitmapComparison(
  config: BeadCropConfig,
  options: { configuredSizeMm: number; groupReferenceDiameterPx: number },
): Promise<BitmapExportComparison> {
  const processedRender = await renderCroppedBeadCanvas(config);
  const normalizedRender = await renderCroppedBeadCanvas(config, {
    targetVisibleDiameterPx: options.groupReferenceDiameterPx,
    skipCanvasCap: true,
  });

  const processedBlob = await canvasToBlob(processedRender.canvas, "image/png");
  const normalizedBlob = await canvasToBlob(normalizedRender.canvas, "image/png");

  const processedFootprint = processedRender.footprintAfterScale;
  const normalizedFootprint = normalizedRender.footprintAfterScale;
  const ratio = normalizedFootprint.diameterPx / processedFootprint.diameterPx;
  const distinct = ratio >= BITMAP_DISTINCT_MIN_RATIO || ratio <= 1 / BITMAP_DISTINCT_MIN_RATIO;

  const result: BitmapExportComparison = {
    configuredSizeMm: options.configuredSizeMm,
    groupReferenceDiameterPx: options.groupReferenceDiameterPx,
    assetVisibleDiameterPx: normalizedRender.assetVisibleDiameterPx,
    normalizationScale: normalizedRender.normalizationScale,
    processed: {
      blob: processedBlob,
      objectUrl: URL.createObjectURL(processedBlob),
      canvasWidthPx: processedRender.canvas.width,
      canvasHeightPx: processedRender.canvas.height,
      visibleDiameterPx: processedFootprint.diameterPx,
    },
    normalized: {
      blob: normalizedBlob,
      objectUrl: URL.createObjectURL(normalizedBlob),
      canvasWidthPx: normalizedRender.canvas.width,
      canvasHeightPx: normalizedRender.canvas.height,
      visibleDiameterPx: normalizedFootprint.diameterPx,
    },
    bitmapsVisuallyDistinct: distinct,
    visibleDiameterRatio: ratio,
    groupCanvasSidePx: normalizedExportCanvasSidePx(options.groupReferenceDiameterPx),
    scaleApplied: normalizedExportDiameterMatchesTarget(
      normalizedFootprint.diameterPx,
      options.groupReferenceDiameterPx,
    ),
  };

  console.group(
    `[Bitmap comparison] ${config.originalUrl?.split("/").pop() ?? "bead"} @ ${options.configuredSizeMm} mm`,
  );
  console.table({
    "Processed canvas": `${result.processed.canvasWidthPx}×${result.processed.canvasHeightPx}`,
    "Processed visible (px)": result.processed.visibleDiameterPx.toFixed(1),
    "Normalized canvas": `${result.normalized.canvasWidthPx}×${result.normalized.canvasHeightPx}`,
    "Normalized visible (px)": result.normalized.visibleDiameterPx.toFixed(1),
    "Visible diameter ratio (norm/proc)": ratio.toFixed(3),
    "Group canvas side (px)": result.groupCanvasSidePx,
    "Bitmaps visually distinct": distinct ? "YES" : "NO — check scale",
    "Scale applied": result.scaleApplied ? "YES" : "NO",
  });
  console.log("Download processed + normalized PNGs from the admin panel to inspect outside the app.");
  console.groupEnd();

  return result;
}

export interface NormalizedExportRenderDiagnosis {
  configuredSizeMm: number;
  groupReferenceDiameterPx: number;
  assetVisibleDiameterPx: number;
  normalizationScale: number;
  canvasSizeBeforeScale: { width: number; height: number };
  canvasSizeAfterScale: { width: number; height: number };
  footprintBeforeScale: { width: number; height: number; diameterPx: number };
  footprintAfterScale: CanvasVisibleFootprint;
  bitmapDimensionsBeforeExport: { width: number; height: number };
  bitmapDimensionsAfterExport: { width: number; height: number };
  measuredVisibleDiameterPx: number;
  targetVisibleDiameterPx: number;
  scaleApplied: boolean;
  previewBlob: Blob;
  previewObjectUrl: string;
  comparison: BitmapExportComparison;
}

/** Single-bead diagnostic — processed vs normalized bitmaps for visual acceptance. */
export async function diagnoseNormalizedExport(
  config: BeadCropConfig,
  options: { configuredSizeMm: number; groupReferenceDiameterPx: number },
): Promise<NormalizedExportRenderDiagnosis> {
  const comparison = await exportBitmapComparison(config, options);

  const report: NormalizedExportRenderDiagnosis = {
    configuredSizeMm: options.configuredSizeMm,
    groupReferenceDiameterPx: options.groupReferenceDiameterPx,
    assetVisibleDiameterPx: comparison.assetVisibleDiameterPx,
    normalizationScale: comparison.normalizationScale,
    canvasSizeBeforeScale: {
      width: comparison.processed.canvasWidthPx,
      height: comparison.processed.canvasHeightPx,
    },
    canvasSizeAfterScale: {
      width: comparison.normalized.canvasWidthPx,
      height: comparison.normalized.canvasHeightPx,
    },
    footprintBeforeScale: {
      width: comparison.processed.visibleDiameterPx,
      height: comparison.processed.visibleDiameterPx,
      diameterPx: comparison.processed.visibleDiameterPx,
    },
    footprintAfterScale: {
      x: 0,
      y: 0,
      width: comparison.normalized.visibleDiameterPx,
      height: comparison.normalized.visibleDiameterPx,
      diameterPx: comparison.normalized.visibleDiameterPx,
    },
    bitmapDimensionsBeforeExport: {
      width: comparison.processed.canvasWidthPx,
      height: comparison.processed.canvasHeightPx,
    },
    bitmapDimensionsAfterExport: {
      width: comparison.normalized.canvasWidthPx,
      height: comparison.normalized.canvasHeightPx,
    },
    measuredVisibleDiameterPx: comparison.normalized.visibleDiameterPx,
    targetVisibleDiameterPx: options.groupReferenceDiameterPx,
    scaleApplied: comparison.scaleApplied,
    previewBlob: comparison.normalized.blob,
    previewObjectUrl: comparison.normalized.objectUrl,
    comparison,
  };

  return report;
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
  const lens = lenses.find((l) => l.id === CROP_PATH_ID) ?? lenses[0];
  const points = migrateBeadAnchors((lens?.points ?? []) as BeadPathAnchor[]);
  const visualBounds = computeBeadVisualBoundsForSave(imgW, imgH, points);
  const physicalMetrics = computeBeadPhysicalMetricsForSave(imgW, imgH, points);

  if (config?.version === BEAD_CROP_CONFIG_V2) {
    return editorLensesToBeadCropConfig(imgW, imgH, originalUrl, lenses, {
      processedUrl: config.processedUrl,
      scale: config.scale,
      visualBounds,
      physicalMetrics,
    });
  }
  return editorLensesToBeadCropConfig(imgW, imgH, originalUrl, lenses, {
    processedUrl: config?.version === BEAD_CROP_CONFIG_V1 ? config.processedUrl : undefined,
    scale: config?.version === BEAD_CROP_CONFIG_V1 ? config.scale : 1,
    visualBounds,
    physicalMetrics,
  });
}
