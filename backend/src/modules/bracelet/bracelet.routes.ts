import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import {
  requireBraceletWriteAuth,
  requireMutationAuth,
  requireUserAuth,
} from "../../middleware/auth-mutations.js";
import { braceletHandlers } from "./bracelet.controller.js";

export function createBraceletRoutes(): Router {
  const router = Router();

  router.get("/configurations", asyncHandler(requireUserAuth), braceletHandlers.listConfigurations);
  router.post("/configurations", asyncHandler(requireBraceletWriteAuth), braceletHandlers.createConfiguration);
  router.get("/configurations/:id", braceletHandlers.getConfiguration);
  router.post("/configurations/:id/recalculate-pricing", braceletHandlers.recalculatePricing);
  router.patch(
    "/configurations/:id/status",
    asyncHandler(requireMutationAuth),
    braceletHandlers.updateStatus,
  );

  return router;
}
