import { Router } from "express";

import { spacerHandlers } from "./spacer.controller.js";

export function createSpacerRoutes(): Router {
  const router = Router();
  router.get("/", spacerHandlers.list);
  router.get("/:id", spacerHandlers.retrieve);
  router.post("/", spacerHandlers.create);
  router.put("/:id", spacerHandlers.update);
  router.delete("/:id", spacerHandlers.remove);
  return router;
}
