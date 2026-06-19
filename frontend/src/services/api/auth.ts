import type {
  AuthenticatedUser,
  ChangePasswordRequest,
  CurrentUserResponse,
  CustomerProfileExtended,
  UpdateCustomerProfileRequest,
} from "@bino-foundry/shared/types";

import { apiRequestData } from "./client";

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface LoginRegisterResponse {
  user: AuthenticatedUser;
  session: AuthSessionResponse | null;
  emailConfirmationRequired?: boolean;
  emailSent?: boolean;
  emailWarning?: string;
}

export type MeResponse = CurrentUserResponse;

export const authApi = {
  register(body: { email: string; password: string; displayName: string }) {
    return apiRequestData<LoginRegisterResponse>("/auth/register", { method: "POST", body });
  },

  login(body: { email: string; password: string }) {
    return apiRequestData<LoginRegisterResponse>("/auth/login", { method: "POST", body });
  },

  refresh(refreshToken: string) {
    return apiRequestData<LoginRegisterResponse>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
  },

  me() {
    return apiRequestData<MeResponse>("/auth/me");
  },

  updateProfile(body: UpdateCustomerProfileRequest) {
    return apiRequestData<CustomerProfileExtended>("/auth/profile", { method: "PATCH", body });
  },

  changePassword(body: ChangePasswordRequest) {
    return apiRequestData<{ ok: boolean; message: string }>("/auth/change-password", {
      method: "POST",
      body,
    });
  },

  logout(refreshToken?: string) {
    return apiRequestData<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
    });
  },

  forgotPassword(body: { email: string; redirectTo?: string }) {
    return apiRequestData<{ ok: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body,
    });
  },

  resetPassword(body: { token: string; password: string }) {
    return apiRequestData<LoginRegisterResponse & { message?: string }>("/auth/reset-password", {
      method: "POST",
      body,
    });
  },

  resendVerification(email: string) {
    return apiRequestData<{ ok: boolean; message: string; emailSent?: boolean }>("/auth/resend-verification", {
      method: "POST",
      body: { email },
    });
  },

  confirmEmail(body: { token: string }) {
    return apiRequestData<LoginRegisterResponse & { message?: string }>("/auth/confirm-email", {
      method: "POST",
      body,
    });
  },
};
