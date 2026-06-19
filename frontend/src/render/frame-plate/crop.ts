import {
  createBeadCropConfigV2,
  getBeadCropPoints,
  isBeadCropConfigValid,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";

import { detectBeadOutline } from "@/render/bead-crop/auto-detect-bead";
import { loadImageForProcessing } from "@/render/bead-crop/image-loader";
import {
  editorLensesToBeadCropConfig,
  pathMaskBounds,
} from "@/render/bead-crop/crop-path";
import { beadCropClipPathStyles } from "@/render/bead-crop/apply-crop";
import { createCanvas } from "@/render/engine/canvas/lens-compositor";
import {
  createLensPolygon,
  migrateAnchors,
  type LensPolygon,
} from "@/render/mask/mask-types";
import { traceLensPath } from "@/render/mask/bezier-path";
import type { FrameRenderView } from "@/types/frame-rendering";

const CROP_PATH_ID = "crop";

export function resolveOriginalPlate(view: FrameRenderView): {
  url: string;
  width: number;
  height: number;
} {
  const url = view.originalPlateUrl?.trim() || view.plateUrl?.trim() || "";
  const width = view.originalWidth ?? view.width;
  const height = view.originalHeight ?? view.height;
  return { url, width, height };
}

export function hasPlateCropApplied(view: FrameRenderView): boolean {
  return isBeadCropConfigValid(view.plateCropConfig);
}

/** Effective compositor dimensions after path crop. */
export function effectivePlateDimensions(view: FrameRenderView): { width: number; height: number } {
  const original = resolveOriginalPlate(view);
  if (!original.url) return { width: view.width, height: view.height };

  const config = view.plateCropConfig;
  if (config && isBeadCropConfigValid(config)) {
    const bounds = pathMaskBounds(config.imageWidth, config.imageHeight, getBeadCropPoints(config));
    if (bounds) return { width: bounds.width, height: bounds.height };
  }

  if (view.plateUrl.trim() !== original.url.trim()) {
    return { width: view.width, height: view.height };
  }

  return { width: original.width, height: original.height };
}

export function plateCropClipStyles(
  config: BeadCropConfig | null | undefined,
): Record<string, string> | undefined {
  return beadCropClipPathStyles(config);
}

/** Auto-detect frame outline as a closed crop path (same algorithm as bead library). */
export async function detectPlateCropConfig(imageUrl: string): Promise<{
  config: BeadCropConfig | null;
  trimmed: boolean;
  message?: string;
}> {
  try {
    const img = await loadImageForProcessing(imageUrl);
    const { points, confidence } = detectBeadOutline(img);
    if (points.length < 3) {
      return {
        config: null,
        trimmed: false,
        message: "No frame outline detected — try Edit crop to draw the boundary manually.",
      };
    }

    const config = createBeadCropConfigV2(
      img.naturalWidth,
      img.naturalHeight,
      imageUrl,
      points,
    );
    return {
      config,
      trimmed: confidence >= 0.35,
      message:
        confidence >= 0.5
          ? "Outline detected — refine with Edit crop if needed."
          : "Outline detected with low confidence — review the crop path.",
    };
  } catch (err) {
    return {
      config: null,
      trimmed: false,
      message: err instanceof Error ? err.message : "Auto crop failed",
    };
  }
}

export function commitCropDraft(
  originalUrl: string,
  imageWidth: number,
  imageHeight: number,
  lenses: LensPolygon[],
  existing?: BeadCropConfig | null,
): BeadCropConfig | null {
  const lens = lenses.find((l) => l.id === CROP_PATH_ID) ?? lenses[0];
  if (migrateAnchors(lens?.points ?? []).length < 3) return null;
  return editorLensesToBeadCropConfig(imageWidth, imageHeight, originalUrl, lenses, {
    processedUrl: existing?.processedUrl,
    scale: existing?.scale ?? 1,
  });
}

/** Export clipped plate PNG from path crop (tight bounds, transparent outside path). */
export async function exportFramePlateFromCropConfig(
  config: BeadCropConfig,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImageForProcessing(config.originalUrl);
  const w = config.imageWidth || img.naturalWidth;
  const h = config.imageHeight || img.naturalHeight;
  const points = getBeadCropPoints(config);
  if (points.length < 3) throw new Error("Crop path needs at least 3 points");

  const bounds = pathMaskBounds(w, h, points);
  if (!bounds) throw new Error("Could not compute crop bounds");

  const lens = createLensPolygon(CROP_PATH_ID, "Crop", migrateAnchors(points as never[]));
  const out = createCanvas(bounds.width, bounds.height);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.clearRect(0, 0, bounds.width, bounds.height);
  ctx.save();
  ctx.translate(-bounds.x, -bounds.y);
  ctx.beginPath();
  traceLensPath(ctx, lens, w, h, true);
  ctx.clip();
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export cropped plate"))),
      "image/png",
    );
  });

  return { blob, width: bounds.width, height: bounds.height };
}

/** In-memory cropped plate for lens detection / editor (draft only). */
export async function exportCroppedPlateBlob(
  config: BeadCropConfig,
): Promise<{ blob: Blob; width: number; height: number }> {
  return exportFramePlateFromCropConfig(config);
}

export function viewRequiresLensClip(view: FrameRenderView): boolean {
  return view.view === "front" || view.view === "three_quarter";
}
