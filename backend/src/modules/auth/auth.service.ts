import type { Request } from "express";

import { getEnv, isProductionLike, resolvePublicAppUrl } from "../../config/env.js";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
} from "../../infra/auth/token-repository.js";
import {
  createUserSession,
  findActiveSessionByRefreshToken,
  revokeSessionByRefreshToken,
  rotateUserSession,
} from "../../infra/auth/session-repository.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  touchLastLogin,
  updateUser,
} from "../../infra/auth/user-repository.js";
import { ConflictError, ValidationError } from "../../lib/errors.js";
import { signAccessToken } from "../../lib/jwt.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { buildAuthUserFromDb, mapProfileFromDb } from "../../lib/rbac.js";
import { assertCanAuthenticate, assertActiveSession, getUserAccess } from "../../lib/account-status.js";
import type {
  ChangePasswordDTO,
  ConfirmEmailDTO,
  ForgotPasswordDTO,
  LoginDTO,
  RegisterDTO,
  ResendVerificationDTO,
  ResetPasswordDTO,
  UpdateProfileDTO,
} from "./auth.validation.js";

function mapSession(accessToken: string, refreshToken: string, expiresAt: number) {
  return { accessToken, refreshToken, expiresAt };
}

function authLink(path: string, token: string): string {
  const base = resolvePublicAppUrl();
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function logAuthLink(label: string, url: string): void {
  if (isProductionLike()) return;
  console.info(`[auth] ${label}: ${url}`);
}

async function issueSession(userId: string, req?: Request) {
  const user = await findUserById(userId);
  if (!user) throw new ValidationError("User not found");

  const session = await createUserSession(userId, {
    userAgent: req?.headers["user-agent"],
    ipAddress: req?.ip,
  });
  const access = signAccessToken(user.id, user.roleCode);

  return {
    user: buildAuthUserFromDb(user),
    session: mapSession(access.token, session.refreshToken, access.expiresAt),
  };
}

export class AuthService {
  async register(dto: RegisterDTO, req?: Request) {
    const existing = await findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);
    const autoVerify = getEnv().APP_ENV === "development";

    const user = await createUser({
      email: dto.email,
      passwordHash,
      fullName: dto.displayName,
      emailVerifiedAt: autoVerify ? new Date().toISOString() : null,
    });

    if (!autoVerify) {
      const token = await createEmailVerificationToken(user.id);
      logAuthLink("Email verification link", authLink("/auth/callback", token) + "&type=verify-email");
      return {
        user: buildAuthUserFromDb(user),
        session: null,
        emailConfirmationRequired: true,
      };
    }

    const issued = await issueSession(user.id, req);
    return {
      ...issued,
      emailConfirmationRequired: false,
    };
  }

  async login(dto: LoginDTO, req?: Request) {
    const user = await findUserByEmail(dto.email);
    if (!user) {
      throw new ValidationError("Invalid email or password");
    }

    const access = await getUserAccess(user.id);
    assertCanAuthenticate(access);

    const passwordOk = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new ValidationError("Invalid email or password");
    }

    if (!user.emailVerifiedAt && getEnv().APP_ENV !== "development") {
      throw new ValidationError("Please verify your email before signing in.");
    }

    await touchLastLogin(user.id);
    return issueSession(user.id, req);
  }

  async refresh(refreshToken: string, req?: Request) {
    const active = await findActiveSessionByRefreshToken(refreshToken);
    if (!active) {
      throw new ValidationError("Session refresh failed");
    }

    const access = await getUserAccess(active.userId);
    assertActiveSession(access);

    const user = await findUserById(active.userId);
    if (!user) {
      throw new ValidationError("Session refresh failed");
    }

    const rotated = await rotateUserSession(active.sessionId, active.userId, {
      userAgent: req?.headers["user-agent"],
      ipAddress: req?.ip,
    });
    const token = signAccessToken(user.id, user.roleCode);

    return {
      user: buildAuthUserFromDb(user),
      session: mapSession(token.token, rotated.refreshToken, token.expiresAt),
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await revokeSessionByRefreshToken(refreshToken);
    }
    return { ok: true };
  }

  async getCurrentUser(userId: string) {
    const user = await findUserById(userId);
    if (!user) return null;
    return {
      user: buildAuthUserFromDb(user),
      profile: mapProfileFromDb(user),
    };
  }

  async getProfile(userId: string) {
    const user = await findUserById(userId);
    if (!user) return null;
    return mapProfileFromDb(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDTO) {
    const patch: Record<string, unknown> = {};
    patch.full_name = dto.displayName;
    if (dto.phone !== undefined) patch.phone_number = dto.phone;
    if (dto.billingDetails !== undefined) patch.billing_details = dto.billingDetails;

    const user = await updateUser(userId, patch);
    return mapProfileFromDb(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDTO) {
    const user = await findUserById(userId);
    if (!user) throw new ValidationError("User not found");

    const passwordOk = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!passwordOk) {
      throw new ValidationError("Current password is incorrect");
    }

    await updateUser(userId, { password_hash: await hashPassword(dto.newPassword) });
    return { ok: true, message: "Password updated." };
  }

  async forgotPassword(dto: ForgotPasswordDTO) {
    const user = await findUserByEmail(dto.email);
    if (user && !user.deletedAt) {
      const token = await createPasswordResetToken(user.id);
      const link = authLink("/auth/callback", token) + "&type=reset-password";
      logAuthLink("Password reset link", link);
    }
    return { ok: true, message: "If an account exists for this email, a reset link has been sent." };
  }

  async resetPassword(dto: ResetPasswordDTO, req?: Request) {
    const userId = await consumePasswordResetToken(dto.token);
    if (!userId) {
      throw new ValidationError("Invalid or expired reset link");
    }

    await updateUser(userId, { password_hash: await hashPassword(dto.password) });
    const issued = await issueSession(userId, req);
    return {
      ...issued,
      message: "Password updated.",
    };
  }

  async resendVerification(dto: ResendVerificationDTO) {
    const user = await findUserByEmail(dto.email);
    if (user && !user.emailVerifiedAt && !user.deletedAt) {
      const token = await createEmailVerificationToken(user.id);
      logAuthLink("Email verification link", authLink("/auth/callback", token) + "&type=verify-email");
    }
    return { ok: true, message: "Verification email sent if the account is unverified." };
  }

  async confirmEmail(dto: ConfirmEmailDTO, req?: Request) {
    const userId = await consumeEmailVerificationToken(dto.token);
    if (!userId) {
      throw new ValidationError("Invalid or expired verification link");
    }

    await updateUser(userId, { email_verified_at: new Date().toISOString() });
    const issued = await issueSession(userId, req);
    return {
      ...issued,
      message: "Email verified.",
    };
  }
}

export const authService = new AuthService();
