import { Router } from "express";

import { beadTypeHandlers } from "./bead-type.controller.js";

export function createBeadTypeRoutes(): Router {
  const router = Router();
  router.get("/", beadTypeHandlers.list);
  router.get("/:id", beadTypeHandlers.retrieve);
  router.post("/", beadTypeHandlers.create);
  router.put("/:id", beadTypeHandlers.update);
  router.delete("/:id", beadTypeHandlers.remove);
  return router;
}
