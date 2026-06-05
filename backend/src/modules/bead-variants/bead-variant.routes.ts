import { Router } from "express";

import { beadVariantHandlers } from "./bead-variant.controller.js";

export function createBeadVariantRoutes(): Router {
  const router = Router();
  router.get("/", beadVariantHandlers.list);
  router.get("/:id", beadVariantHandlers.retrieve);
  router.post("/", beadVariantHandlers.create);
  router.put("/:id", beadVariantHandlers.update);
  router.delete("/:id", beadVariantHandlers.remove);
  return router;
}
