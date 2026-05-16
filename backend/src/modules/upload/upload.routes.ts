import { Router } from "express";

import { multerSingleImageField } from "../../middleware/multer-image.js";
import { uploadHandlers } from "./upload.controller.js";

export function createUploadRoutes(): Router {
  const router = Router();
  router.post("/staging", multerSingleImageField, uploadHandlers.uploadStaging);
  router.post("/", multerSingleImageField, uploadHandlers.uploadImage);
  return router;
}
