import { Router } from "express";

import { tagHandlers } from "./tag.controller.js";

export function createTagRoutes(): Router {
  const router = Router();
  router.get("/", tagHandlers.list);
  router.post("/", tagHandlers.create);
  router.delete("/:id", tagHandlers.remove);
  return router;
}
