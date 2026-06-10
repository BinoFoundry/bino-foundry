import { ValidationError } from "../../lib/errors.js";
import { cloudinaryConfigured } from "../../infra/cloudinary.js";
import { catalogStorageConfigured } from "../../infra/storage/catalog-object-storage.js";
import { uploadService } from "../upload/upload.service.js";

const MAX_THUMB_BYTES = 512 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=\s]+)$/i;

export function parseThumbnailDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
  const trimmed = dataUrl.trim();
  const match = DATA_URL_PATTERN.exec(trimmed);
  if (!match) {
    throw new ValidationError("Invalid preview thumbnail (expected image data URL)");
  }

  const mime = match[1].toLowerCase().replace("jpg", "jpeg");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0) {
    throw new ValidationError("Preview thumbnail is empty");
  }
  if (buffer.length > MAX_THUMB_BYTES) {
    throw new ValidationError("Preview thumbnail exceeds 512KB limit");
  }

  return { buffer, mime: mime === "jpeg" ? "image/jpeg" : `image/${mime.split("/")[1]}` };
}

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  return ".jpg";
}

/**
 * Persists a client-generated preview image. Falls back to storing a compact data URL when
 * object storage is unavailable (local dev).
 */
export async function persistDesignThumbnail(
  userId: string,
  designPublicId: string,
  dataUrl: string,
): Promise<string> {
  const { buffer, mime } = parseThumbnailDataUrl(dataUrl);

  if (catalogStorageConfigured() || cloudinaryConfigured()) {
    const ext = extensionForMime(mime);
    const file = {
      buffer,
      mimetype: mime,
      originalname: `${designPublicId}${ext}`,
    } as Express.Multer.File;

    const { imageUrl } = await uploadService.uploadImageBuffer(file, `design-thumbnails/${userId}`);
    return imageUrl;
  }

  if (buffer.length <= 128 * 1024) {
    return dataUrl;
  }

  throw new ValidationError(
    "Configure Supabase storage or Cloudinary to upload design preview thumbnails",
  );
}
