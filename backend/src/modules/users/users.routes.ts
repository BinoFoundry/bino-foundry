import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { attachJwtAuth } from "../../middleware/auth-jwt.js";
import { requirePermission, requireUserAuth } from "../../middleware/auth-mutations.js";
import { usersHandlers } from "./users.controller.js";

export function createUsersRoutes(): Router {
  const router = Router();

  router.use(asyncHandler(attachJwtAuth));
  router.use(asyncHandler(requireUserAuth));
  router.use(asyncHandler(requirePermission("customers.manage")));

  router.get("/", usersHandlers.list);
  router.post("/", usersHandlers.create);
  router.get("/:id", usersHandlers.retrieve);
  router.patch("/:id", usersHandlers.update);
  router.delete("/:id", usersHandlers.remove);
  router.post("/:id/reset-password", usersHandlers.resetPassword);
  router.get("/:id/designs", usersHandlers.listDesigns);
  router.get("/:id/orders", usersHandlers.listOrders);

  return router;
}
