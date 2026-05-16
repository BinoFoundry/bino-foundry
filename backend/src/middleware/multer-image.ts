import multer from "multer";

const memoryStorage = multer.memoryStorage();

export const fiftyMb = 50 * 1024 * 1024;

export const multerSingleImageField = multer({
  storage: memoryStorage,
  limits: {
    fileSize: fiftyMb,
  },
}).single("image");
