import {
  getBeadCropPoints,
  isBeadCropConfigValid,
  isLensClipConfigValid,
  resolveFrameExclusionShapes,
  type BeadCropConfig,
  type LensClipConfig,
} from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { logger } from "../../lib/logger.js";
import { deleteCatalogAssetUrls } from "../catalog-lifecycle/catalog-asset-cleanup.js";
import { uploadService } from "../upload/upload.service.js";

import { downloadImageBuffer, exportCroppedFramePng } from "./export-cropped-frame.js";

export type RebuildFrameResult =
  | { status: "rebuilt"; frameId: string; name: string; views: string[] }
  | { status: "skipped"; frameId: string; name: string; reason: string }
  | { status: "failed"; frameId: string; name: string; error: string };

export type RebuildAssetsSummary = {
  total: number;
  rebuilt: number;
  skipped: number;
  failed: number;
  results: RebuildFrameResult[];
};

export type RebuildAssetsOptions = {
  dryRun?: boolean;
  frameId?: string;
  limit?: number;
  onProgress?: (current: number, total: number, result: RebuildFrameResult) => void;
};

type FrameRow = {
  id: string;
  name: string;
  marketing_copy: Record<string, unknown> | null;
};

type ViewRow = {
  id: string;
  frame_id: string;
  view_axis: string;
  plate_url: string;
  image_width: number;
  image_height: number;
  original_plate_url: string | null;
  original_image_width: number | null;
  original_image_height: number | null;
  plate_crop_config: BeadCropConfig | null;
  clip_config: LensClipConfig | null;
  clip_status: string | null;
  mask_config: unknown;
  mask_status: string | null;
};

function asMulterPng(buffer: Buffer, filename: string): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: filename,
    encoding: "7bit",
    mimetype: "image/png",
    size: buffer.length,
    buffer,
    destination: "",
    filename,
    path: "",
    stream: undefined as never,
  };
}

function resolveOriginalUrl(view: ViewRow): string {
  const fromCrop =
    view.plate_crop_config &&
    typeof view.plate_crop_config === "object" &&
    "originalUrl" in view.plate_crop_config
      ? String(view.plate_crop_config.originalUrl ?? "").trim()
      : "";
  return fromCrop || view.original_plate_url?.trim() || view.plate_url?.trim() || "";
}

function migrateClipConfig(clip: LensClipConfig | null): LensClipConfig | null {
  if (!clip || !isLensClipConfigValid(clip)) return clip;
  const exclusions = resolveFrameExclusionShapes(clip);
  if (!exclusions.length) return clip;
  if ((clip.frameExclusions?.length ?? 0) > 0) return clip;

  // Persist migrated exclusions at view level; drop writing legacy per-lens paths.
  return {
    ...clip,
    frameExclusions: exclusions,
    lenses: clip.lenses.map((lens) => {
      const { exclusionPathDs: _drop, ...rest } = lens;
      return rest;
    }),
    updatedAt: Date.now(),
  };
}

async function rebuildOneView(
  view: ViewRow,
  dryRun: boolean,
): Promise<{ rebuilt: boolean; skippedReason?: string; newPlateUrl?: string; oldProcessed?: string }> {
  const crop = view.plate_crop_config;
  if (!crop || !isBeadCropConfigValid(crop)) {
    return { rebuilt: false, skippedReason: "no valid plate crop path" };
  }
  if (getBeadCropPoints(crop).length < 3) {
    return { rebuilt: false, skippedReason: "crop path has fewer than 3 points" };
  }

  const originalUrl = resolveOriginalUrl(view);
  if (!originalUrl) {
    return { rebuilt: false, skippedReason: "missing original upload URL" };
  }

  const oldProcessed =
    (typeof crop.processedUrl === "string" && crop.processedUrl.trim()) ||
    (view.plate_url && view.plate_url.trim() !== originalUrl ? view.plate_url.trim() : "") ||
    "";

  if (dryRun) {
    return { rebuilt: true, newPlateUrl: "(dry-run)", oldProcessed };
  }

  const sourceBytes = await downloadImageBuffer(originalUrl);
  const exported = await exportCroppedFramePng(
    {
      ...crop,
      originalUrl,
      imageWidth: crop.imageWidth || view.original_image_width || view.image_width,
      imageHeight: crop.imageHeight || view.original_image_height || view.image_height,
    },
    sourceBytes,
  );

  const { imageUrl } = await uploadService.uploadImageBuffer(
    asMulterPng(exported.buffer, `frame-${view.view_axis}-${Date.now()}.png`),
    "frames",
  );

  if (!imageUrl || imageUrl === originalUrl) {
    throw new Error("Upload returned empty or original URL");
  }

  const nextCrop: BeadCropConfig = {
    ...crop,
    originalUrl,
    processedUrl: imageUrl,
    imageWidth: crop.imageWidth || view.original_image_width || view.image_width,
    imageHeight: crop.imageHeight || view.original_image_height || view.image_height,
    updatedAt: Date.now(),
  };

  const nextClip = migrateClipConfig(view.clip_config);

  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from("frame_render_views")
    .update({
      plate_url: imageUrl,
      image_width: exported.width,
      image_height: exported.height,
      original_plate_url: originalUrl,
      original_image_width:
        view.original_image_width ?? crop.imageWidth ?? view.image_width,
      original_image_height:
        view.original_image_height ?? crop.imageHeight ?? view.image_height,
      plate_crop_config: nextCrop,
      ...(nextClip ? { clip_config: nextClip } : {}),
    })
    .eq("id", view.id);

  assertNoDbError(error);

  return { rebuilt: true, newPlateUrl: imageUrl, oldProcessed };
}

async function updateFrameMarketingImages(
  frame: FrameRow,
  frontPlateUrl: string | undefined,
  dryRun: boolean,
): Promise<void> {
  if (!frontPlateUrl || dryRun) return;

  const mc =
    frame.marketing_copy && typeof frame.marketing_copy === "object"
      ? { ...frame.marketing_copy }
      : {};
  mc.legacy_frame_images = [frontPlateUrl];

  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from("frames")
    .update({ marketing_copy: mc, updated_at: new Date().toISOString() })
    .eq("id", frame.id);
  assertNoDbError(error);
}

export class RebuildSunglassesAssetsService {
  async run(options: RebuildAssetsOptions = {}): Promise<RebuildAssetsSummary> {
    const dryRun = Boolean(options.dryRun);
    const supabase = getSupabaseServiceRole();

    let framesQuery = supabase.from("frames").select("id,name,marketing_copy").order("name", {
      ascending: true,
    });
    if (options.frameId) {
      framesQuery = framesQuery.eq("id", options.frameId);
    }

    const { data: frameRows, error: framesErr } = await framesQuery;
    assertNoDbError(framesErr);

    let frames = (frameRows ?? []) as FrameRow[];
    if (options.limit && options.limit > 0) {
      frames = frames.slice(0, options.limit);
    }

    const results: RebuildFrameResult[] = [];
    const total = frames.length;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]!;
      const current = i + 1;
      let result: RebuildFrameResult;

      try {
        const { data: views, error: viewsErr } = await supabase
          .from("frame_render_views")
          .select("*")
          .eq("frame_id", frame.id)
          .order("view_axis", { ascending: true });
        assertNoDbError(viewsErr);

        const viewRows = (views ?? []) as ViewRow[];
        if (!viewRows.length) {
          result = {
            status: "skipped",
            frameId: frame.id,
            name: frame.name,
            reason: "no render views",
          };
        } else {
          const rebuiltViews: string[] = [];
          const skipReasons: string[] = [];
          const staleUrls: string[] = [];
          let frontPlate: string | undefined;

          for (const view of viewRows) {
            try {
              const out = await rebuildOneView(view, dryRun);
              if (out.rebuilt) {
                rebuiltViews.push(view.view_axis);
                if (view.view_axis === "front" && out.newPlateUrl && out.newPlateUrl !== "(dry-run)") {
                  frontPlate = out.newPlateUrl;
                }
                if (
                  out.oldProcessed &&
                  out.newPlateUrl &&
                  out.oldProcessed !== out.newPlateUrl &&
                  out.oldProcessed !== resolveOriginalUrl(view)
                ) {
                  staleUrls.push(out.oldProcessed);
                }
              } else if (out.skippedReason) {
                skipReasons.push(`${view.view_axis}: ${out.skippedReason}`);
              }
            } catch (err) {
              throw new Error(
                `${view.view_axis}: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }

          if (rebuiltViews.length) {
            await updateFrameMarketingImages(frame, frontPlate, dryRun);
            if (!dryRun && staleUrls.length) {
              await deleteCatalogAssetUrls(staleUrls);
            }
            result = {
              status: "rebuilt",
              frameId: frame.id,
              name: frame.name,
              views: rebuiltViews,
            };
          } else {
            result = {
              status: "skipped",
              frameId: frame.id,
              name: frame.name,
              reason: skipReasons.join("; ") || "nothing to rebuild",
            };
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("sunglasses asset rebuild failed", {
          frameId: frame.id,
          name: frame.name,
          error: message,
        });
        result = {
          status: "failed",
          frameId: frame.id,
          name: frame.name,
          error: message,
        };
      }

      results.push(result);
      options.onProgress?.(current, total, result);
    }

    const summary: RebuildAssetsSummary = {
      total,
      rebuilt: results.filter((r) => r.status === "rebuilt").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };

    return summary;
  }
}

export const rebuildSunglassesAssetsService = new RebuildSunglassesAssetsService();
