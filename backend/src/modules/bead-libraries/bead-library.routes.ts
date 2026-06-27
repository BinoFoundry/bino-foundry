import { Router } from "express";

import { beadLibraryHandlers } from "./bead-library.controller.js";

export function createBeadLibraryRoutes(): Router {
  const router = Router();
  router.get("/", beadLibraryHandlers.list);
  router.post("/recalculate-bounds-metadata", beadLibraryHandlers.recalculateBoundsMetadata);
  router.get("/:id", beadLibraryHandlers.retrieve);
  router.post("/", beadLibraryHandlers.create);
  router.put("/:id/crop", beadLibraryHandlers.updateCrop);
  router.put("/:id", beadLibraryHandlers.update);
  router.delete("/:id", beadLibraryHandlers.remove);
  return router;
}
