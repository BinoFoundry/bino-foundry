import { Router } from "express";

import { requireMutationApiKey } from "../middleware/auth-mutations.js";
import { createBeadLibraryRoutes } from "../modules/bead-libraries/bead-library.routes.js";
import { createBeadTypeRoutes } from "../modules/bead-types/bead-type.routes.js";
import { createBeadSizeRoutes } from "../modules/bead-sizes/bead-size.routes.js";
import { createBraceletRoutes } from "../modules/bracelet/bracelet.routes.js";
import { createFrameRoutes } from "../modules/frames/frame.routes.js";
import { createSunglassesRoutes } from "../modules/sunglasses/sunglasses.routes.js";
import { createRenderingRoutes } from "../modules/rendering/rendering.routes.js";
import { createSettingsRoutes } from "../modules/settings/settings.routes.js";
import { createUploadRoutes } from "../modules/upload/upload.routes.js";

export function createCatalogRoutes(): Router {
  const router = Router();

  router.use(requireMutationApiKey);
  router.use("/rendering", createRenderingRoutes());
  router.use("/frames", createFrameRoutes());
  router.use("/bead-types", createBeadTypeRoutes());
  router.use("/bead-sizes", createBeadSizeRoutes());
  router.use("/bead-libraries", createBeadLibraryRoutes());
  router.use("/bracelet", createBraceletRoutes());
  router.use("/sunglasses", createSunglassesRoutes());
  router.use("/settings", createSettingsRoutes());
  router.use("/upload", createUploadRoutes());

  return router;
}
