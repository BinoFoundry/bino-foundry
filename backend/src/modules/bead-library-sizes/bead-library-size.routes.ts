import { Router } from "express";

import { beadLibrarySizeHandlers } from "./bead-library-size.controller.js";

export function createBeadLibrarySizeRoutes(): Router {
  const router = Router();
  router.get("/", beadLibrarySizeHandlers.list);
  router.get("/suggest/:id", beadLibrarySizeHandlers.suggest);
  router.put("/library/:id", beadLibrarySizeHandlers.sync);
  return router;
}
