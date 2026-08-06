import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { requirePermission, requireUserAuth } from "../../middleware/auth-mutations.js";
import { ordersHandlers } from "./orders.controller.js";

export function createOrdersRoutes(): Router {
  const router = Router();

  router.get(
    "/admin",
    asyncHandler(requireUserAuth),
    asyncHandler(requirePermission("orders.manage")),
    ordersHandlers.listAdminOrders,
  );
  router.get(
    "/admin/:id",
    asyncHandler(requireUserAuth),
    asyncHandler(requirePermission("orders.manage")),
    ordersHandlers.getAdminOrder,
  );
  router.patch(
    "/admin/:id/status",
    asyncHandler(requireUserAuth),
    asyncHandler(requirePermission("orders.manage")),
    ordersHandlers.updateAdminOrderStatus,
  );
  router.patch(
    "/admin/:id/notes",
    asyncHandler(requireUserAuth),
    asyncHandler(requirePermission("orders.manage")),
    ordersHandlers.updateAdminOrderNotes,
  );

  router.get("/", asyncHandler(requireUserAuth), ordersHandlers.listOrders);
  router.get("/:id", asyncHandler(requireUserAuth), ordersHandlers.getOrder);
  router.post("/", asyncHandler(requireUserAuth), ordersHandlers.createOrder);

  return router;
}
