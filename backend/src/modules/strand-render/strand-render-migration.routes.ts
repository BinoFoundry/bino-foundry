import { Router } from "express";

import { strandRenderMigrationHandlers } from "./strand-render-migration.controller.js";

export function createStrandRenderMigrationRoutes(): Router {
  const router = Router();
  router.post("/initialize-missing-types", strandRenderMigrationHandlers.initializeMissing);
  router.post("/run", strandRenderMigrationHandlers.runFullMigration);
  router.post("/cleanup-library-overrides", strandRenderMigrationHandlers.cleanupLibraries);
  router.post("/reset-libraries-to-type", strandRenderMigrationHandlers.resetLibrariesToType);
  router.post("/types/:typeId/reset-to-system", strandRenderMigrationHandlers.resetTypeToSystem);
  router.post("/types/:typeId/apply-to-libraries", strandRenderMigrationHandlers.applyTypeToLibraries);
  return router;
}
