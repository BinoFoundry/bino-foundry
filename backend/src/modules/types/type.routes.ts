import { Router } from "express";

import { typeHandlers } from "./type.controller.js";

export function createTypeRoutes(): Router {
  const router = Router();

  router.get("/", typeHandlers.list);
  router.get("/:id", typeHandlers.retrieve);
  router.post("/", typeHandlers.create);
  router.put("/:id", typeHandlers.update);
  router.delete("/:id", typeHandlers.remove);

  return router;
}
