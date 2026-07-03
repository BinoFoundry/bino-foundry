import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RequestHandler } from "express";
import multer, { MulterError } from "multer";

import { PayloadTooLargeError, UnsupportedMediaError } from "../lib/errors.js";

export const fiftyMb = 50 * 1024 * 1024;

/** Matches Supabase `assets` bucket `allowed_mime_types` (see migration 000002). */
export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

const uploadTempDir = path.join(os.tmpdir(), "bino-uploads");
fs.mkdirSync(uploadTempDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: uploadTempDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const multerParser = multer({
  storage: diskStorage,
  limits: {
    fileSize: fiftyMb,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype?.trim().toLowerCase() ?? "";
    if (!mime || !ALLOWED_UPLOAD_MIME_TYPES.has(mime)) {
      cb(new UnsupportedMediaError(`Unsupported image format: ${mime || "unknown"}`));
      return;
    }
    cb(null, true);
  },
}).single("image");

function mapMulterError(error: MulterError): PayloadTooLargeError | UnsupportedMediaError {
  if (error.code === "LIMIT_FILE_SIZE") {
    return new PayloadTooLargeError(`Image file is too large (max ${Math.round(fiftyMb / (1024 * 1024))} MB)`);
  }
  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return new UnsupportedMediaError('Upload field must be named "image"');
  }
  return new UnsupportedMediaError(error.message);
}

/** Parse multipart image into a temp file — avoids holding large buffers in heap. */
export const multerSingleImageField: RequestHandler = (req, res, next) => {
  multerParser(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof MulterError) {
      next(mapMulterError(error));
      return;
    }
    next(error);
  });
};

/** Remove temp disk file after upload handler completes. */
export async function cleanupMulterTempFile(file: Express.Multer.File | undefined): Promise<void> {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch {
    // Best-effort — temp dir is cleared by the OS.
  }
}
