import { z } from "zod";

import { ACCOUNT_STATUSES, ASSIGNABLE_USER_ROLES } from "@bino-foundry/shared/types";

const assignableRoleSchema = z.enum(ASSIGNABLE_USER_ROLES);
const accountStatusSchema = z.enum(ACCOUNT_STATUSES);

const billingDetailsSchema = z
  .object({
    addressLine1: z.string().max(200).optional(),
    addressLine2: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    postalCode: z.string().max(32).optional(),
    country: z.string().max(120).optional(),
  })
  .optional();

export const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  role: assignableRoleSchema.or(z.enum(["staff", "super_admin"])).optional(),
  accountStatus: accountStatusSchema.optional(),
  sort: z.enum(["createdAt", "lastLoginAt", "displayName", "email"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const userIdParam = z.object({
  id: z.string().uuid(),
});

export const createUserDto = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  role: assignableRoleSchema.default("customer"),
  accountStatus: accountStatusSchema.default("active"),
});

export const updateUserDto = z
  .object({
    displayName: z.string().trim().max(200).optional(),
    email: z.string().email().max(320).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    role: assignableRoleSchema.optional(),
    accountStatus: accountStatusSchema.optional(),
    billingDetails: billingDetailsSchema,
  })
  .refine((body) => Object.keys(body).length > 0, { message: "No fields to update" });

export const resetPasswordDto = z.object({
  newPassword: z.string().min(8).max(128),
});

export type ListUsersQueryDTO = z.output<typeof listUsersQuery>;
export type CreateUserDTO = z.output<typeof createUserDto>;
export type UpdateUserDTO = z.infer<typeof updateUserDto>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordDto>;
