import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { ValidationError } from "../../lib/errors.js";
import { sendJson } from "../../lib/http-response.js";
import { uploadService } from "./upload.service.js";

async function uploadImage(req: Request, res: Response): Promise<void> {
  if (!req.file?.buffer) {
    throw new ValidationError("No file uploaded");
  }
  sendJson(res, await uploadService.uploadImageBuffer(req.file));
}

async function uploadStaging(req: Request, res: Response): Promise<void> {
  if (!req.file?.buffer) {
    throw new ValidationError("No file uploaded");
  }

  const batch =
    typeof req.query.batch === "string" && req.query.batch.trim() ? req.query.batch.trim() : "default";

  sendJson(res, await uploadService.uploadSupabaseStaging(req.file, batch));
}

export const uploadHandlers = {
  uploadImage: asyncHandler(uploadImage),
  uploadStaging: asyncHandler(uploadStaging),
};
