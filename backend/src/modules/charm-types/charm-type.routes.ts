import { Router } from "express";

import { charmTypeHandlers } from "./charm-type.controller.js";

export function createCharmTypeRoutes(): Router {
  const router = Router();
  router.get("/", charmTypeHandlers.list);
  router.get("/:id", charmTypeHandlers.retrieve);
  router.post("/", charmTypeHandlers.create);
  router.put("/:id", charmTypeHandlers.update);
  router.delete("/:id", charmTypeHandlers.remove);
  return router;
}
