import type { StorageBucketId } from "../constants/index.js";

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertKebab(segment: string, label: string): string {
  const s = segment.trim().toLowerCase();
  if (!SEGMENT.test(s)) {
    throw new Error(`${label} must be lowercase kebab-case: ${segment}`);
  }
  return s;
}

export function normalizeOriginalFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

/** `{yyyymm}/{batch}/{uuid}_{file}` staging key (private `uploads` bucket) */
export function uploadStagingObjectKey(uploadBatchId: string, uuid: string, originalName: string): string {
  const d = new Date();
  const yyyymm = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const safe = normalizeOriginalFilename(originalName);
  const batch = assertKebab(uploadBatchId, "uploadBatchId");
  return `${yyyymm}/${batch}/${uuid}_${safe}`;
}

export function framesBaseObjectKey(frameSlug: string, fileBase: string, extWithDot = ".webp"): string {
  const slug = assertKebab(frameSlug, "frameSlug");
  const stem = normalizeOriginalFilename(fileBase.replace(extWithDot, ""));
  return `${slug}/base/${stem}${extWithDot}`;
}

export function framesLensMaskObjectKey(frameSlug: string, extWithDot = ".png"): string {
  return `${assertKebab(frameSlug, "frameSlug")}/layers/lens-mask${extWithDot}`;
}

export function framesTintOverlayObjectKey(frameSlug: string, tintCode: string, extWithDot = ".webp"): string {
  return `${assertKebab(frameSlug, "frameSlug")}/tints/${assertKebab(tintCode, "tintCode")}${extWithDot}`;
}

export function framesMarketingObjectKey(frameSlug: string, rank: number, descriptor: string, extWithDot = ".webp"): string {
  const slug = assertKebab(frameSlug, "frameSlug");
  const stem = normalizeOriginalFilename(descriptor);
  return `${slug}/marketing/${String(rank).padStart(2, "0")}_${stem}${extWithDot}`;
}

/** Original bead upload — `crystals` bucket (public catalogue). */
export function beadLibraryOriginalObjectKey(publicId: string, extWithDot = ".png"): string {
  return `bracelets/beads/${assertKebab(publicId, "beadPublicId")}/original${extWithDot}`;
}

/** Cropped/processed bead render asset. */
export function beadLibraryProcessedObjectKey(publicId: string, extWithDot = ".png"): string {
  return `bracelets/beads/${assertKebab(publicId, "beadPublicId")}/processed${extWithDot}`;
}

/** @deprecated Use `beadLibraryProcessedObjectKey` */
export function crystalsBeadObjectKey(
  publicId: string,
  density: "" | "@2x" | "@3x" = "",
  extWithDot = ".png",
): string {
  const slug = assertKebab(publicId, "crystalPublicId");
  return `bracelets/beads/${slug}${density}${extWithDot}`;
}

export function crystalsCharmObjectKey(charmId: string, extWithDot = ".png"): string {
  return `bracelets/charms/${assertKebab(charmId, "charmId")}${extWithDot}`;
}

export function crystalsSpacerObjectKey(spacerId: string, extWithDot = ".png"): string {
  return `bracelets/spacers/${assertKebab(spacerId, "spacerId")}${extWithDot}`;
}

export function assetsFramePreviewKey(frameSlug: string, presetKey: string): string {
  return `previews/frame/${assertKebab(frameSlug, "frameSlug")}/${assertKebab(presetKey, "preset")}.webp`;
}

export function assetsCrystalThumbnailKey(crystalPublicId: string): string {
  return `thumbnails/crystal/${assertKebab(crystalPublicId, "crystalPublicId")}_thumb.webp`;
}

export function assetsUiObjectKey(componentSlug: string, assetStem: string, extWithDot = ".webp"): string {
  return `ui/${assertKebab(componentSlug, "componentSlug")}/${normalizeOriginalFilename(assetStem)}${extWithDot}`;
}

export function assetsRenderCacheKey(renderJobId: string, compositionHashHex: string): string {
  return `renders/${assertKebab(renderJobId, "renderJobId")}/${compositionHashHex.slice(0, 64)}.webp`;
}

export function storageRef(bucket: StorageBucketId, objectKey: string): { bucket: StorageBucketId; objectKey: string } {
  return { bucket, objectKey: objectKey.replace(/^\/+/, "") };
}
