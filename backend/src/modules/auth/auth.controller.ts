import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendData, sendDataCreated, sendJson } from "../../lib/http-response.js";
import { getAuthUserId } from "../../middleware/auth-mutations.js";
import { validateBody } from "../../lib/validation.js";
import { authService } from "./auth.service.js";
import {
  changePasswordDto,
  confirmEmailDto,
  forgotPasswordDto,
  loginDto,
  logoutDto,
  refreshDto,
  registerDto,
  resendVerificationDto,
  resetPasswordDto,
  updateProfileDto,
} from "./auth.validation.js";

async function register(req: Request, res: Response): Promise<void> {
  const body = validateBody(registerDto, req.body);
  sendDataCreated(req, res, await authService.register(body, req));
}

async function login(req: Request, res: Response): Promise<void> {
  const body = validateBody(loginDto, req.body);
  sendData(req, res, await authService.login(body, req));
}

async function refresh(req: Request, res: Response): Promise<void> {
  const body = validateBody(refreshDto, req.body);
  sendData(req, res, await authService.refresh(body.refreshToken, req));
}

async function me(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const current = await authService.getCurrentUser(userId);
  if (!current) {
    sendData(req, res, { authenticated: false, user: null, profile: null });
    return;
  }
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
  const body = validateBody(changePasswordDto, req.body);
  sendData(req, res, await authService.changePassword(userId, body));
}

async function forgotPassword(req: Request, res: Response): Promise<void> {
  const body = validateBody(forgotPasswordDto, req.body);
  sendData(req, res, await authService.forgotPassword(body));
}

async function resetPassword(req: Request, res: Response): Promise<void> {
  const body = validateBody(resetPasswordDto, req.body);
  sendData(req, res, await authService.resetPassword(body, req));
}

async function resendVerification(req: Request, res: Response): Promise<void> {
  const body = validateBody(resendVerificationDto, req.body);
  sendData(req, res, await authService.resendVerification(body));
}

async function confirmEmail(req: Request, res: Response): Promise<void> {
  const body = validateBody(confirmEmailDto, req.body);
  sendData(req, res, await authService.confirmEmail(body, req));
}

async function logout(req: Request, res: Response): Promise<void> {
  const body = validateBody(logoutDto, req.body);
  sendData(req, res, await authService.logout(body.refreshToken));
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
