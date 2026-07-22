import { Router } from "express";

import { sunglassesHandlers } from "./sunglasses.controller.js";

export function createSunglassesRoutes(): Router {
  const router = Router();

  router.get("/catalog", sunglassesHandlers.getCatalog);
  router.get("/catalog/admin", sunglassesHandlers.getAdminCatalog);

  router.get("/lens-tints", sunglassesHandlers.listLensTints);
  router.post("/lens-tints", sunglassesHandlers.createLensTint);
  router.put("/lens-tints/:id", sunglassesHandlers.updateLensTint);
  router.delete("/lens-tints/:id", sunglassesHandlers.removeLensTint);

  router.get("/options", sunglassesHandlers.listBuilderOptions);
  router.post("/options", sunglassesHandlers.createBuilderOption);
  router.put("/options/:id", sunglassesHandlers.updateBuilderOption);
  router.delete("/options/:id", sunglassesHandlers.removeBuilderOption);

  router.get("/lens-render-presets", sunglassesHandlers.listLensRenderPresets);
  router.get("/lens-render-system-defaults", sunglassesHandlers.getLensRenderSystemDefaults);
  router.put("/lens-render-system-defaults", sunglassesHandlers.updateLensRenderSystemDefaults);
  router.post("/lens-render-presets", sunglassesHandlers.createLensRenderPreset);
  router.put("/lens-render-presets/:id", sunglassesHandlers.updateLensRenderPreset);
  router.post("/lens-render-presets/:id/duplicate", sunglassesHandlers.duplicateLensRenderPreset);
  router.delete("/lens-render-presets/:id", sunglassesHandlers.removeLensRenderPreset);

  return router;
}
