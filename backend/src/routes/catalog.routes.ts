import { Router } from "express";

import { requireMutationApiKey } from "../middleware/auth-mutations.js";
import { createCrystalRoutes } from "../modules/crystals/crystal.routes.js";
import { createFrameRoutes } from "../modules/frames/frame.routes.js";
import { createTypeRoutes } from "../modules/types/type.routes.js";
import { createSunglassesRoutes } from "../modules/sunglasses/sunglasses.routes.js";
import { createUploadRoutes } from "../modules/upload/upload.routes.js";

export function createCatalogRoutes(): Router {
  const router = Router();

  router.use(requireMutationApiKey);
  router.use("/frames", createFrameRoutes());
  router.use("/crystals", createCrystalRoutes());
  router.use("/types", createTypeRoutes());
  router.use("/sunglasses", createSunglassesRoutes());
  router.use("/upload", createUploadRoutes());

  return router;
}
