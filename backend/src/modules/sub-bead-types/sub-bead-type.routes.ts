import { Router } from "express";

import { subBeadTypeHandlers } from "./sub-bead-type.controller.js";

export function createSubBeadTypeRoutes(): Router {
  const router = Router();
  router.get("/", subBeadTypeHandlers.list);
  router.get("/:id", subBeadTypeHandlers.retrieve);
  router.post("/", subBeadTypeHandlers.create);
  router.put("/:id", subBeadTypeHandlers.update);
  router.delete("/:id", subBeadTypeHandlers.remove);
  return router;
}
