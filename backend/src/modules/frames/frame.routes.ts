import { Router } from "express";

import { frameHandlers } from "./frame.controller.js";

export function createFrameRoutes(): Router {
  const router = Router();

  router.get("/", frameHandlers.list);
  router.get("/:id", frameHandlers.retrieve);
  router.post("/", frameHandlers.create);
  router.put("/:id", frameHandlers.update);
  router.delete("/:id", frameHandlers.remove);

  return router;
}
