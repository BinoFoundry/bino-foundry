import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { beadLibrarySizeHandlers } from "./bead-library-size.controller.js";

export function createBeadLibrarySizeRoutes(): Router {
  const router = Router();
  router.get("/", asyncHandler(beadLibrarySizeHandlers.list));
  router.put(
    "/library/:id/normalized-exports",
    asyncHandler(beadLibrarySizeHandlers.saveNormalizedExports),
  );
  router.put("/library/:id", asyncHandler(beadLibrarySizeHandlers.sync));
  router.post(
    "/library/:id/recalculate-normalization",
    asyncHandler(beadLibrarySizeHandlers.recalculateNormalization),
  );
  return router;
}
