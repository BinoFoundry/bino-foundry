import { Router } from "express";

import { requireMutationApiKey } from "../middleware/auth-mutations.js";
import { createCrystalRoutes } from "../modules/crystals/crystal.routes.js";
import { createFrameRoutes } from "../modules/frames/frame.routes.js";
import { createTypeRoutes } from "../modules/types/type.routes.js";
import { createCharmRoutes } from "../modules/charms/charm.routes.js";
import { createSpacerRoutes } from "../modules/spacers/spacer.routes.js";
import { createCharmTypeRoutes } from "../modules/charm-types/charm-type.routes.js";
import { createSpacerTypeRoutes } from "../modules/spacer-types/spacer-type.routes.js";
import { createSunglassesRoutes } from "../modules/sunglasses/sunglasses.routes.js";
import { createRenderingRoutes } from "../modules/rendering/rendering.routes.js";
import { createUploadRoutes } from "../modules/upload/upload.routes.js";

export function createCatalogRoutes(): Router {
  const router = Router();

  router.use(requireMutationApiKey);
  router.use("/rendering", createRenderingRoutes());
  router.use("/frames", createFrameRoutes());
  router.use("/crystals", createCrystalRoutes());
  router.use("/types", createTypeRoutes());
  router.use("/charms", createCharmRoutes());
  router.use("/spacers", createSpacerRoutes());
  router.use("/charm-types", createCharmTypeRoutes());
  router.use("/spacer-types", createSpacerTypeRoutes());
  router.use("/sunglasses", createSunglassesRoutes());
  router.use("/upload", createUploadRoutes());

  return router;
}
