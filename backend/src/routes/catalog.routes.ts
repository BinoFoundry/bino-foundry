import { Router } from "express";

import { asyncHandler } from "../lib/async-handler.js";
import { attachJwtAuth } from "../middleware/auth-jwt.js";
import { requireMutationAuth } from "../middleware/auth-mutations.js";
import { createBeadLibraryRoutes } from "../modules/bead-libraries/bead-library.routes.js";
import { createBeadTypeRoutes } from "../modules/bead-types/bead-type.routes.js";
import { createBeadSizeRoutes } from "../modules/bead-sizes/bead-size.routes.js";
import { beadLibrarySizeHandlers } from "../modules/bead-library-sizes/bead-library-size.controller.js";
import { createBraceletRoutes } from "../modules/bracelet/bracelet.routes.js";
import { createFrameRoutes } from "../modules/frames/frame.routes.js";
import { createSunglassesRoutes } from "../modules/sunglasses/sunglasses.routes.js";
import { createRenderingRoutes } from "../modules/rendering/rendering.routes.js";
import { createSettingsRoutes } from "../modules/settings/settings.routes.js";
import { createUploadRoutes } from "../modules/upload/upload.routes.js";

export function createCatalogRoutes(): Router {
  const router = Router();

  router.use(asyncHandler(attachJwtAuth));

  router.use("/bracelet", createBraceletRoutes());
  router.get("/bead-library-sizes", asyncHandler(beadLibrarySizeHandlers.list));

  router.use(asyncHandler(requireMutationAuth));
  router.put("/bead-library-sizes/library/:id", asyncHandler(beadLibrarySizeHandlers.sync));
  router.get("/bead-library-sizes/suggest/:id", asyncHandler(beadLibrarySizeHandlers.suggest));
  router.use("/rendering", createRenderingRoutes());
  router.use("/frames", createFrameRoutes());
  router.use("/bead-types", createBeadTypeRoutes());
  router.use("/bead-sizes", createBeadSizeRoutes());
  router.use("/bead-libraries", createBeadLibraryRoutes());
  router.use("/sunglasses", createSunglassesRoutes());
  router.use("/settings", createSettingsRoutes());
  router.use("/upload", createUploadRoutes());

  return router;
}
