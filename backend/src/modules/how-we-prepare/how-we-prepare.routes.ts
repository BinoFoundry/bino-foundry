import { Router } from "express";

import { howWePrepareHandlers } from "./how-we-prepare.controller.js";

export function createHowWePrepareRoutes(): Router {
  const router = Router();
  router.get("/", howWePrepareHandlers.list);
  router.get("/:id", howWePrepareHandlers.retrieve);
  router.post("/", howWePrepareHandlers.create);
  router.put("/:id", howWePrepareHandlers.update);
  router.delete("/:id", howWePrepareHandlers.remove);
  return router;
}
