import { z } from "zod";

export const registerDto = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const loginDto = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

export const refreshDto = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordDto = z.object({
  email: z.string().trim().email().max(320),
  redirectTo: z.string().url().max(2048).optional(),
});

export const resetPasswordDto = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  password: z.string().min(8).max(128),
});

export const resendVerificationDto = z.object({
  email: z.string().trim().email().max(320),
});

export const confirmEmailDto = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
});

export const billingDetailsDto = z.object({
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
  country: z.string().trim().length(2).optional(),
});

export const updateProfileDto = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  billingDetails: billingDetailsDto.optional(),
});

export const changePasswordDto = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export type RegisterDTO = z.infer<typeof registerDto>;
export type LoginDTO = z.infer<typeof loginDto>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordDto>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordDto>;
export type ResendVerificationDTO = z.infer<typeof resendVerificationDto>;
export type ConfirmEmailDTO = z.infer<typeof confirmEmailDto>;
export type UpdateProfileDTO = z.infer<typeof updateProfileDto>;
export type ChangePasswordDTO = z.infer<typeof changePasswordDto>;
