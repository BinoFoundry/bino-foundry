import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireUserAuth } from "../../middleware/auth-mutations.js";
import { designsHandlers } from "./designs.controller.js";

export function createDesignsRoutes(): Router {
  const router = Router();

  router.get("/", asyncHandler(requireUserAuth), designsHandlers.listDesigns);
  router.get("/:id", asyncHandler(requireUserAuth), designsHandlers.getDesign);
  router.post("/", asyncHandler(requireUserAuth), designsHandlers.saveDesign);
  router.post("/bulk-delete", asyncHandler(requireUserAuth), designsHandlers.bulkDeleteDesigns);
  router.post("/:id/duplicate", asyncHandler(requireUserAuth), designsHandlers.duplicateDesign);
  router.delete("/:id", asyncHandler(requireUserAuth), designsHandlers.deleteDesign);

  return router;
}
