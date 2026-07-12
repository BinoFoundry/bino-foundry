import { Router } from "express";

import { asyncHandler } from "../lib/async-handler.js";
import { attachJwtAuth } from "../middleware/auth-jwt.js";
import { requireMutationAuth } from "../middleware/auth-mutations.js";
import { createBeadAvailabilityStatusRoutes } from "../modules/bead-availability-statuses/bead-availability-status.routes.js";
import { createBeadLibraryRoutes } from "../modules/bead-libraries/bead-library.routes.js";
import { createBeadTypeRoutes } from "../modules/bead-types/bead-type.routes.js";
import { createSubBeadTypeRoutes } from "../modules/sub-bead-types/sub-bead-type.routes.js";
import { createStrandRenderMigrationRoutes } from "../modules/strand-render/strand-render-migration.routes.js";
import { createBeadSizeRoutes } from "../modules/bead-sizes/bead-size.routes.js";
import { createWristSizeRoutes } from "../modules/wrist-sizes/wrist-size.routes.js";
import { createHowWePrepareRoutes } from "../modules/how-we-prepare/how-we-prepare.routes.js";
import { createTagRoutes } from "../modules/tags/tag.routes.js";
import { beadLibrarySizeHandlers } from "../modules/bead-library-sizes/bead-library-size.controller.js";
import { createBeadLibrarySizeRoutes } from "../modules/bead-library-sizes/bead-library-size.routes.js";
import { createBraceletRoutes } from "../modules/bracelet/bracelet.routes.js";
import { createFrameRoutes } from "../modules/frames/frame.routes.js";
import { createSunglassesRoutes } from "../modules/sunglasses/sunglasses.routes.js";
import { createRenderingRoutes } from "../modules/rendering/rendering.routes.js";
import { createSettingsRoutes } from "../modules/settings/settings.routes.js";
import { createUploadRoutes } from "../modules/upload/upload.routes.js";
import { createAdminSettingsRoutes } from "./admin-settings.routes.js";
import { createDesignsRoutes } from "../modules/designs/designs.routes.js";
import { createOrdersRoutes } from "../modules/orders/orders.routes.js";

export function createCatalogRoutes(): Router {
  const router = Router();

  router.use(asyncHandler(attachJwtAuth));

  router.use("/bracelet", createBraceletRoutes());
  router.use("/designs", createDesignsRoutes());
  router.use("/orders", createOrdersRoutes());
  router.get("/bead-library-sizes", asyncHandler(beadLibrarySizeHandlers.list));
  router.use("/bead-availability-statuses", createBeadAvailabilityStatusRoutes());
  router.use("/catalog-availability-statuses", createBeadAvailabilityStatusRoutes());

  router.use("/admin/settings", createAdminSettingsRoutes());

  router.use(asyncHandler(requireMutationAuth));
  router.use("/bead-library-sizes", createBeadLibrarySizeRoutes());
  router.use("/rendering", createRenderingRoutes());
  router.use("/frames", createFrameRoutes());
  router.use("/bead-types", createBeadTypeRoutes());
  router.use("/tags", createTagRoutes());
  router.use("/sub-bead-types", createSubBeadTypeRoutes());
  router.use("/strand-render-migration", createStrandRenderMigrationRoutes());
  router.use("/bead-sizes", createBeadSizeRoutes());
  router.use("/wrist-sizes", createWristSizeRoutes());
  router.use("/how-we-prepare-options", createHowWePrepareRoutes());
  router.use("/bead-libraries", createBeadLibraryRoutes());
  router.use("/sunglasses", createSunglassesRoutes());
  router.use("/settings", createSettingsRoutes());
  router.use("/upload", createUploadRoutes());

  return router;
}
