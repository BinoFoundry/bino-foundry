import { Router } from "express";

import { asyncHandler } from "../lib/async-handler.js";
import { attachJwtAuth } from "../middleware/auth-jwt.js";
import { requirePermission, requireUserAuth } from "../middleware/auth-mutations.js";
import { smtpHandlers } from "../modules/settings/smtp.controller.js";

/** Admin-only settings (SMTP, etc.) — all methods require authentication. */
export function createAdminSettingsRoutes(): Router {
  const router = Router();

  router.use(asyncHandler(attachJwtAuth));
  router.use(asyncHandler(requireUserAuth));
  router.use(asyncHandler(requirePermission("admin.access")));

  router.get("/smtp", smtpHandlers.getSmtpSettings);
  router.put("/smtp", smtpHandlers.updateSmtpSettings);
  router.post("/smtp/test", smtpHandlers.testSmtpSettings);

  return router;
}
