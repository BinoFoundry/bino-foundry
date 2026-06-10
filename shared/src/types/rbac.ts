/** Platform roles — extend here when adding Staff, Designer, etc. */
export type UserRole = "customer" | "staff" | "admin" | "super_admin";

/** Permission identifiers returned by the Current User API. */
export type Permission =
  | "profile.own.read"
  | "profile.own.write"
  | "designs.own.read"
  | "designs.own.write"
  | "orders.own.read"
  | "orders.own.write"
  | "admin.access"
  | "catalogue.read"
  | "catalogue.write"
  | "orders.manage"
  | "customers.manage"
  | "designs.manage";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  role: UserRole;
  permissions: Permission[];
}

export interface CurrentUserResponse {
  authenticated: boolean;
  user: AuthenticatedUser;
  profile: CustomerProfileExtended | null;
}

export interface CustomerProfileExtended {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  role: UserRole;
  billingDetails: BillingDetails;
  createdAt: string;
  updatedAt: string;
}

export interface BillingDetails {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface UpdateCustomerProfileRequest {
  displayName?: string;
  phone?: string;
  billingDetails?: BillingDetails;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
