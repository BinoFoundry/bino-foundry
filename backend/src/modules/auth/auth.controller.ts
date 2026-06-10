import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendData, sendDataCreated, sendJson } from "../../lib/http-response.js";
import { getAuthUserId } from "../../middleware/auth-mutations.js";
import { validateBody } from "../../lib/validation.js";
import { verifySupabaseAccessToken } from "../../middleware/auth-jwt.js";
import { authService } from "./auth.service.js";
import {
  changePasswordDto,
  confirmEmailDto,
  forgotPasswordDto,
  loginDto,
  refreshDto,
  registerDto,
  resendVerificationDto,
  resetPasswordDto,
  updateProfileDto,
} from "./auth.validation.js";

async function register(req: Request, res: Response): Promise<void> {
  const body = validateBody(registerDto, req.body);
  sendDataCreated(req, res, await authService.register(body));
}

async function login(req: Request, res: Response): Promise<void> {
  const body = validateBody(loginDto, req.body);
  sendData(req, res, await authService.login(body));
}

async function refresh(req: Request, res: Response): Promise<void> {
  const body = validateBody(refreshDto, req.body);
  sendData(req, res, await authService.refresh(body.refreshToken));
}

async function me(req: Request, res: Response): Promise<void> {
  const bearer = req.headers.authorization?.slice("Bearer ".length).trim();
  const supabaseUser = bearer ? await verifySupabaseAccessToken(bearer) : null;
  if (!supabaseUser) {
    sendData(req, res, { authenticated: false, user: null, profile: null });
    return;
  }

  const current = await authService.buildCurrentUser(supabaseUser);
  sendData(req, res, {
    authenticated: true,
    user: current.user,
    profile: current.profile,
  });
}

async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const body = validateBody(updateProfileDto, req.body);
  sendData(req, res, await authService.updateProfile(userId, body));
}

async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const email = req.auth?.scheme === "jwt" ? req.auth.email : undefined;
  if (!email) {
    sendData(req, res, { ok: false, message: "Email required to change password" });
    return;
  }
  const body = validateBody(changePasswordDto, req.body);
  sendData(req, res, await authService.changePassword(userId, email, body));
}

async function forgotPassword(req: Request, res: Response): Promise<void> {
  const body = validateBody(forgotPasswordDto, req.body);
  sendData(req, res, await authService.forgotPassword(body));
}

async function resetPassword(req: Request, res: Response): Promise<void> {
  const body = validateBody(resetPasswordDto, req.body);
  sendData(req, res, await authService.resetPassword(body));
}

async function resendVerification(req: Request, res: Response): Promise<void> {
  const body = validateBody(resendVerificationDto, req.body);
  sendData(req, res, await authService.resendVerification(body));
}

async function confirmEmail(req: Request, res: Response): Promise<void> {
  const body = validateBody(confirmEmailDto, req.body);
  sendData(req, res, await authService.confirmEmail(body));
}

async function logout(_req: Request, res: Response): Promise<void> {
  sendJson(res, { ok: true });
}

export const authHandlers = {
  register: asyncHandler(register),
  login: asyncHandler(login),
  refresh: asyncHandler(refresh),
  me: asyncHandler(me),
  logout: asyncHandler(logout),
  updateProfile: asyncHandler(updateProfile),
  changePassword: asyncHandler(changePassword),
  forgotPassword: asyncHandler(forgotPassword),
  resetPassword: asyncHandler(resetPassword),
  resendVerification: asyncHandler(resendVerification),
  confirmEmail: asyncHandler(confirmEmail),
};
