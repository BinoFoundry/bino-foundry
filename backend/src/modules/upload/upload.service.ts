import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { CatalogStoredObjectDescriptor } from "@bino-foundry/shared";
import { uploadStagingObjectKey } from "@bino-foundry/shared/storage";
import { v2 as cloudinary } from "cloudinary";

import { cloudinaryConfigured } from "../../infra/cloudinary.js";
import {
  catalogStorageConfigured,
  deleteCatalogObject,
  parsePublicCatalogUrl,
  putCatalogObject,
  publicCatalogHttpUrl,
} from "../../infra/storage/catalog-object-storage.js";
import { ValidationError } from "../../lib/errors.js";

function adminAssetObjectKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `ui/admin/${safeFolder}/${randomUUID()}${ext}`;
}

function normalizeUploadMime(mimetype: string | undefined): string {
  const mime = mimetype?.trim().toLowerCase() ?? "";
  if (mime === "image/jpg") return "image/jpeg";
  return mime || "application/octet-stream";
}

async function readUploadBytes(file: Express.Multer.File): Promise<Buffer> {
  if (file.buffer?.length) return file.buffer;
  if (file.path) return fs.promises.readFile(file.path);
  throw new ValidationError("No file uploaded");
}

export class UploadService {
  async uploadImageBuffer(file: Express.Multer.File, folder = "bino-foundry"): Promise<{ imageUrl: string }> {
    const body = await readUploadBytes(file);
    const contentType = normalizeUploadMime(file.mimetype);

    if (catalogStorageConfigured()) {
      return this.uploadViaSupabasePublicAsset(file, folder, body, contentType);
    }

    if (cloudinaryConfigured()) {
      return this.uploadViaCloudinary(file, folder, body);
    }

    throw new ValidationError(
      "Image upload is unavailable (configure Cloudinary or Supabase SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  /** Best-effort rollback for failed multi-step admin uploads (assets bucket only). */
  async deleteUploadedPublicUrl(publicUrl: string): Promise<void> {
    if (!catalogStorageConfigured()) return;
    const parsed = parsePublicCatalogUrl(publicUrl);
    if (!parsed || parsed.bucket !== "assets") return;
    if (!parsed.objectKey.startsWith("ui/admin/")) return;
    await deleteCatalogObject(parsed.bucket, parsed.objectKey);
  }

  private async uploadViaCloudinary(
    file: Express.Multer.File,
    folder: string,
    body: Buffer,
  ): Promise<{ imageUrl: string }> {
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url) {
          reject(new ValidationError("Cloudinary upload returned empty response"));
          return;
        }
        resolve(result.secure_url);
      });
      uploadStream.end(body);
    });

    return { imageUrl };
  }

  /** Public `assets` bucket — hotlinkable admin previews without Cloudinary. */
  private async uploadViaSupabasePublicAsset(
    file: Express.Multer.File,
    folder: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ imageUrl: string }> {
    const objectKey = adminAssetObjectKey(folder, file.originalname ?? "upload.jpg");

    const stored = await putCatalogObject({
      bucket: "assets",
      objectKey,
      body,
      contentType,
      upsert: false,
    });

    const imageUrl = stored.publicUrl ?? publicCatalogHttpUrl("assets", objectKey);
    if (!imageUrl) {
      throw new ValidationError("Storage upload succeeded but public URL could not be resolved");
    }

    return { imageUrl };
  }

  /**
   * Staging multipart write into Supabase **`uploads`** (private bucket) before promotion worker runs.
   * Layout keys match [`database/storage/STORAGE_LAYOUT.md`](../../../../database/storage/STORAGE_LAYOUT.md).
   */
  async uploadSupabaseStaging(
    file: Express.Multer.File,
    uploadBatchId = "default",
  ): Promise<CatalogStoredObjectDescriptor> {
    if (!catalogStorageConfigured()) {
      throw new ValidationError("Catalog storage is unavailable (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
    }

    const objectKey = uploadStagingObjectKey(uploadBatchId, randomUUID(), file.originalname ?? "upload.bin");
    const body = await readUploadBytes(file);
    const contentType = normalizeUploadMime(file.mimetype);

    return putCatalogObject({
      bucket: "uploads",
      objectKey,
      body,
      contentType,
      upsert: false,
    });
  }
}

export const uploadService = new UploadService();
