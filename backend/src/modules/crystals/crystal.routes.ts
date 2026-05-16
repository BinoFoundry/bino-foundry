import { Router } from "express";

import { crystalHandlers } from "./crystal.controller.js";

export function createCrystalRoutes(): Router {
  const router = Router();
  router.get("/", crystalHandlers.list);
  router.get("/:id", crystalHandlers.retrieve);
  router.post("/", crystalHandlers.create);
  router.put("/:id", crystalHandlers.update);
  router.delete("/:id", crystalHandlers.remove);
  return router;
}
