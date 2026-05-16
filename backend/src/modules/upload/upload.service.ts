import { randomUUID } from "node:crypto";
import path from "node:path";

import type { CatalogStoredObjectDescriptor } from "@bino-foundry/shared";
import { uploadStagingObjectKey } from "@bino-foundry/shared/storage";
import { v2 as cloudinary } from "cloudinary";

import { cloudinaryConfigured } from "../../infra/cloudinary.js";
import {
  catalogStorageConfigured,
  putCatalogObject,
  publicCatalogHttpUrl,
} from "../../infra/storage/catalog-object-storage.js";
import { ValidationError } from "../../lib/errors.js";

function adminAssetObjectKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `ui/admin/${safeFolder}/${randomUUID()}${ext}`;
}

export class UploadService {
  async uploadImageBuffer(file: Express.Multer.File, folder = "bino-foundry"): Promise<{ imageUrl: string }> {
    if (cloudinaryConfigured()) {
      return this.uploadViaCloudinary(file, folder);
    }

    if (catalogStorageConfigured()) {
      return this.uploadViaSupabasePublicAsset(file, folder);
    }

    throw new ValidationError(
      "Image upload is unavailable (configure Cloudinary or Supabase SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  private async uploadViaCloudinary(file: Express.Multer.File, folder: string): Promise<{ imageUrl: string }> {
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
      uploadStream.end(file.buffer);
    });

    return { imageUrl };
  }

  /** Public `assets` bucket — hotlinkable admin previews without Cloudinary. */
  private async uploadViaSupabasePublicAsset(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ imageUrl: string }> {
    const objectKey = adminAssetObjectKey(folder, file.originalname ?? "upload.jpg");
    const contentType = file.mimetype?.trim() ? file.mimetype : "application/octet-stream";

    const stored = await putCatalogObject({
      bucket: "assets",
      objectKey,
      body: file.buffer,
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

    const contentType = file.mimetype?.trim() ? file.mimetype : "application/octet-stream";

    return putCatalogObject({
      bucket: "uploads",
      objectKey,
      body: file.buffer,
      contentType,
      upsert: false,
    });
  }
}

export const uploadService = new UploadService();
