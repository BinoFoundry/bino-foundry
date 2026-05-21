import { Router } from "express";

import { charmHandlers } from "./charm.controller.js";

export function createCharmRoutes(): Router {
  const router = Router();
  router.get("/", charmHandlers.list);
  router.get("/:id", charmHandlers.retrieve);
  router.post("/", charmHandlers.create);
  router.put("/:id", charmHandlers.update);
  router.delete("/:id", charmHandlers.remove);
  return router;
}
