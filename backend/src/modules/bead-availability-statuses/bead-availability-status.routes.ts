import { Router } from "express";

import { beadAvailabilityStatusHandlers } from "./bead-availability-status.controller.js";

export function createBeadAvailabilityStatusRoutes(): Router {
  const router = Router();
  router.get("/", beadAvailabilityStatusHandlers.list);
  return router;
}
