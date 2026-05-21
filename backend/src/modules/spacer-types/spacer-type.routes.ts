import { Router } from "express";

import { spacerTypeHandlers } from "./spacer-type.controller.js";

export function createSpacerTypeRoutes(): Router {
  const router = Router();
  router.get("/", spacerTypeHandlers.list);
  router.get("/:id", spacerTypeHandlers.retrieve);
  router.post("/", spacerTypeHandlers.create);
  router.put("/:id", spacerTypeHandlers.update);
  router.delete("/:id", spacerTypeHandlers.remove);
  return router;
}
