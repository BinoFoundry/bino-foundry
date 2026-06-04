import { Router } from "express";

import { renderingHandlers } from "./rendering.controller.js";

export function createRenderingRoutes(): Router {
  const router = Router({ mergeParams: true });

  router.get("/frames/batch", renderingHandlers.getBundlesBatch);
  router.get("/frames/:frameId/bundle", renderingHandlers.getBundle);
  router.post("/validate-clip", renderingHandlers.validateClip);
  router.put("/frames/:frameId/views/:viewAxis", renderingHandlers.upsertView);
  router.delete("/frames/:frameId/views/:viewAxis", renderingHandlers.removeView);

  return router;
}
