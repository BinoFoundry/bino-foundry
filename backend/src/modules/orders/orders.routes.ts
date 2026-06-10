import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireUserAuth } from "../../middleware/auth-mutations.js";
import { ordersHandlers } from "./orders.controller.js";

export function createOrdersRoutes(): Router {
  const router = Router();

  router.get("/", asyncHandler(requireUserAuth), ordersHandlers.listOrders);
  router.get("/:id", asyncHandler(requireUserAuth), ordersHandlers.getOrder);
  router.post("/", asyncHandler(requireUserAuth), ordersHandlers.createOrder);

  return router;
}
