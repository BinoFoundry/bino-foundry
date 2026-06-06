import { Router } from "express";

import { wristSizeHandlers } from "./wrist-size.controller.js";

export function createWristSizeRoutes(): Router {
  const router = Router();
  router.get("/", wristSizeHandlers.list);
  router.get("/:id", wristSizeHandlers.retrieve);
  router.post("/", wristSizeHandlers.create);
  router.put("/:id", wristSizeHandlers.update);
  router.delete("/:id", wristSizeHandlers.remove);
  return router;
}
