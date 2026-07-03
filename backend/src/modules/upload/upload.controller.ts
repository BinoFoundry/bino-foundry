import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { ValidationError } from "../../lib/errors.js";
import { sendJson, sendNoContent } from "../../lib/http-response.js";
import { cleanupMulterTempFile } from "../../middleware/multer-image.js";
import { uploadService } from "./upload.service.js";

async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError("No file uploaded");
    }
    sendJson(res, await uploadService.uploadImageBuffer(req.file));
  } finally {
    await cleanupMulterTempFile(req.file);
  }
}

async function uploadStaging(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError("No file uploaded");
    }

    const batch =
      typeof req.query.batch === "string" && req.query.batch.trim() ? req.query.batch.trim() : "default";

    sendJson(res, await uploadService.uploadSupabaseStaging(req.file, batch));
  } finally {
    await cleanupMulterTempFile(req.file);
  }
}

async function deleteUploadedAsset(req: Request, res: Response): Promise<void> {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!url) {
    throw new ValidationError("url is required");
  }
  await uploadService.deleteUploadedPublicUrl(url);
  sendNoContent(res);
}

export const uploadHandlers = {
  uploadImage: asyncHandler(uploadImage),
  uploadStaging: asyncHandler(uploadStaging),
  deleteUploadedAsset: asyncHandler(deleteUploadedAsset),
};
