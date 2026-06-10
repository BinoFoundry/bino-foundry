import type { BillingDetails, UserRole } from "./rbac.js";

export type AccountStatus = "active" | "inactive" | "suspended";

/** Roles assignable from the admin Users module (extend as new roles ship). */
export const ASSIGNABLE_USER_ROLES = ["customer", "admin"] as const satisfies readonly UserRole[];

export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "inactive", "suspended"] as const satisfies readonly AccountStatus[];

export interface AdminUserSummary {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  savedDesignsCount: number;
  ordersCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  updatedAt: string;
}

export interface AdminUserDesignSummary {
  id: string;
  title: string | null;
  productType: "bracelet" | "sunglasses";
  status: string;
  subtotal: number;
  currencyCode: string;
  previewThumbnailUrl: string | null;
  updatedAt: string;
}

export interface AdminUserOrderSummary {
  id: string;
  status: string;
  totalAmount: number;
  currencyCode: string;
  designId: string | null;
  designTitle: string | null;
  productType: "bracelet" | "sunglasses" | null;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  billingDetails: BillingDetails;
  recentDesigns: AdminUserDesignSummary[];
  recentOrders: AdminUserOrderSummary[];
}

export interface ListUsersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole;
  accountStatus?: AccountStatus;
  sort?: "createdAt" | "lastLoginAt" | "displayName" | "email";
  sortDir?: "asc" | "desc";
}

export interface ListUsersResponse {
  items: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreatePlatformUserRequest {
  email: string;
  password: string;
  displayName?: string;
  phone?: string;
  role?: AssignableUserRole;
  accountStatus?: AccountStatus;
}

export interface UpdatePlatformUserRequest {
  displayName?: string;
  email?: string;
  phone?: string;
  role?: AssignableUserRole;
  accountStatus?: AccountStatus;
  billingDetails?: BillingDetails;
}

export interface AdminResetPasswordRequest {
  newPassword: string;
}
