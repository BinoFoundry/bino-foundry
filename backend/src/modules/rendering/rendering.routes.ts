import { Router } from "express";

import { renderingHandlers } from "./rendering.controller.js";

export function createRenderingRoutes(): Router {
  const router = Router({ mergeParams: true });

  router.get("/frames/:frameId/bundle", renderingHandlers.getBundle);
  router.put("/frames/:frameId/views/:viewAxis", renderingHandlers.upsertView);
  router.delete("/frames/:frameId/views/:viewAxis", renderingHandlers.removeView);

  return router;
}
