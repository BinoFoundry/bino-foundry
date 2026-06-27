import { Router } from "express";

import { beadSizeHandlers } from "./bead-size.controller.js";

export function createBeadSizeRoutes(): Router {
  const router = Router();
  router.get("/", beadSizeHandlers.list);
  router.post("/recalculate-mm-group-references", beadSizeHandlers.recalculateMmGroupReferences);
  router.get("/:id/pending-normalized-reexport", beadSizeHandlers.listPendingNormalizedReexport);
  router.get("/:id", beadSizeHandlers.retrieve);
  router.post("/", beadSizeHandlers.create);
  router.put("/:id", beadSizeHandlers.update);
  router.delete("/:id", beadSizeHandlers.remove);
  return router;
}
