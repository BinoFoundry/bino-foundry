import { Router } from "express";

import { braceletHandlers } from "./bracelet.controller.js";

export function createBraceletRoutes(): Router {
  const router = Router();
  router.get("/pricing-rules", braceletHandlers.getPricingRules);
  router.post("/configurations", braceletHandlers.createConfiguration);
  router.get("/configurations/:id", braceletHandlers.getConfiguration);
  return router;
}
