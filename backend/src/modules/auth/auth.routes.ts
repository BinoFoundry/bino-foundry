import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { requireUserAuth } from "../../middleware/auth-mutations.js";
import { authHandlers } from "./auth.controller.js";

export function createAuthRoutes(): Router {
  const router = Router();

  router.post("/register", authHandlers.register);
  router.post("/login", authHandlers.login);
  router.post("/refresh", authHandlers.refresh);
  router.post("/logout", authHandlers.logout);
  router.post("/forgot-password", authHandlers.forgotPassword);
  router.post("/reset-password", authHandlers.resetPassword);
  router.post("/resend-verification", authHandlers.resendVerification);
  router.post("/confirm-email", authHandlers.confirmEmail);
  router.patch("/profile", asyncHandler(requireUserAuth), authHandlers.updateProfile);
  router.post("/change-password", asyncHandler(requireUserAuth), authHandlers.changePassword);
  router.get("/me", asyncHandler(requireUserAuth), authHandlers.me);

  return router;
}
