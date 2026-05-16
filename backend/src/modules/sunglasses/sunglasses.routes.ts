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

  router.get("/frame-colors", sunglassesHandlers.listFrameColors);
  router.post("/frame-colors", sunglassesHandlers.createFrameColor);
  router.put("/frame-colors/:id", sunglassesHandlers.updateFrameColor);
  router.delete("/frame-colors/:id", sunglassesHandlers.removeFrameColor);

  return router;
}
