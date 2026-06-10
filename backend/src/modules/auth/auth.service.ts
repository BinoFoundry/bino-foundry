import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { getEnv, resolvePublicAppUrl } from "../../config/env.js";
import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ValidationError } from "../../lib/errors.js";
import { buildAuthUser, resolveUserRole } from "../../lib/rbac.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
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

function authClient() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnv();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new ValidationError("Authentication is not configured on this server");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function mapSession(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
  };
}

function mapProfileRow(row: Record<string, unknown>) {
  return {
    id: String(row.user_id),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    role: String(row.role ?? "customer"),
    billingDetails: (row.billing_details as Record<string, unknown> | null) ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertProfile(
  userId: string,
  email: string | null,
  displayName: string | null,
  role = "customer",
) {
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase.from("customer_profiles").upsert(
    {
      user_id: userId,
      email,
      display_name: displayName,
      role,
    },
    { onConflict: "user_id" },
  );
  assertNoDbError(error);
}

function mapAuthResponse(user: User, profileRole?: string | null) {
  return buildAuthUser(user, profileRole);
}

export class AuthService {
  async register(dto: RegisterDTO) {
    const client = authClient();
    const { data, error } = await client.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: {
          ...(dto.displayName ? { display_name: dto.displayName } : {}),
          role: "customer",
        },
      },
    });

    if (error) {
      throw new ValidationError(error.message);
    }
    if (!data.user) {
      throw new ValidationError("Registration failed");
    }

    await upsertProfile(data.user.id, data.user.email ?? dto.email, dto.displayName ?? null, "customer");

    const user = mapAuthResponse(data.user, "customer");

    if (!data.session) {
      return {
        user,
        session: null,
        emailConfirmationRequired: true,
      };
    }

    return {
      user,
      session: mapSession(data.session),
      emailConfirmationRequired: false,
    };
  }

  async login(dto: LoginDTO) {
    const client = authClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.user || !data.session) {
      throw new ValidationError(error?.message ?? "Invalid email or password");
    }

    const profile = await this.getProfile(data.user.id);
    const displayName =
      profile?.displayName ??
      (typeof data.user.user_metadata?.display_name === "string"
        ? data.user.user_metadata.display_name
        : null);

    await upsertProfile(
      data.user.id,
      data.user.email ?? dto.email,
      displayName,
      resolveUserRole(data.user, profile?.role ?? null),
    );

    return {
      user: mapAuthResponse(data.user, profile?.role ?? null),
      session: mapSession(data.session),
    };
  }

  async refresh(refreshToken: string) {
    const client = authClient();
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.user || !data.session) {
      throw new ValidationError(error?.message ?? "Session refresh failed");
    }
    const profile = await this.getProfile(data.user.id);
    return {
      user: mapAuthResponse(data.user, profile?.role ?? null),
      session: mapSession(data.session),
    };
  }

  async getProfile(userId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("user_id, email, display_name, phone, role, billing_details, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) return null;
    return mapProfileRow(data as Record<string, unknown>);
  }

  async buildCurrentUser(supabaseUser: User) {
    const profile = await this.getProfile(supabaseUser.id);
    const user = mapAuthResponse(supabaseUser, profile?.role ?? null);
    if (profile?.displayName && !user.displayName) {
      user.displayName = profile.displayName;
    }
    return { user, profile };
  }

  async updateProfile(userId: string, dto: UpdateProfileDTO) {
    const supabase = getSupabaseServiceRole();
    const patch: Record<string, unknown> = {};
    if (dto.displayName !== undefined) patch.display_name = dto.displayName;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.billingDetails !== undefined) patch.billing_details = dto.billingDetails;

    const { data, error } = await supabase
      .from("customer_profiles")
      .update(patch)
      .eq("user_id", userId)
      .select("user_id, email, display_name, phone, role, billing_details, created_at, updated_at")
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Profile not found");
    return mapProfileRow(data as Record<string, unknown>);
  }

  async changePassword(userId: string, email: string, dto: ChangePasswordDTO) {
    const client = authClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: dto.currentPassword,
    });
    if (signInError) {
      throw new ValidationError("Current password is incorrect");
    }

    const service = getSupabaseServiceRole();
    const { error } = await service.auth.admin.updateUserById(userId, {
      password: dto.newPassword,
    });
    if (error) {
      throw new ValidationError(error.message);
    }
    return { ok: true, message: "Password updated." };
  }

  async forgotPassword(dto: ForgotPasswordDTO) {
    const client = authClient();
    const redirectTo = dto.redirectTo ?? `${resolvePublicAppUrl()}/auth/callback`;
    const { error } = await client.auth.resetPasswordForEmail(dto.email, { redirectTo });
    if (error) {
      throw new ValidationError(error.message);
    }
    return { ok: true, message: "If an account exists for this email, a reset link has been sent." };
  }

  async resetPassword(dto: ResetPasswordDTO) {
    const client = authClient();
    const { data: sessionData, error: sessionError } = await client.auth.setSession({
      access_token: dto.accessToken,
      refresh_token: dto.refreshToken ?? "",
    });
    if (sessionError || !sessionData.user) {
      throw new ValidationError(sessionError?.message ?? "Invalid or expired reset link");
    }

    const { data, error } = await client.auth.updateUser({ password: dto.password });
    if (error || !data.user) {
      throw new ValidationError(error?.message ?? "Could not update password");
    }

    const profile = await this.getProfile(data.user.id);
    const { data: sessionState } = await client.auth.getSession();
    const user = mapAuthResponse(data.user, profile?.role ?? null);

    if (!sessionState.session) {
      return {
        user,
        session: null,
        message: "Password updated. Sign in with your new password.",
      };
    }

    return {
      user,
      session: mapSession(sessionState.session),
      message: "Password updated.",
    };
  }

  async resendVerification(dto: ResendVerificationDTO) {
    const client = authClient();
    const redirectTo = `${resolvePublicAppUrl()}/auth/callback`;
    const { error } = await client.auth.resend({
      type: "signup",
      email: dto.email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      throw new ValidationError(error.message);
    }
    return { ok: true, message: "Verification email sent if the account is unverified." };
  }

  async confirmEmail(dto: ConfirmEmailDTO) {
    const client = authClient();
    const { data, error } = await client.auth.setSession({
      access_token: dto.accessToken,
      refresh_token: dto.refreshToken ?? "",
    });
    if (error || !data.user || !data.session) {
      throw new ValidationError(error?.message ?? "Invalid or expired verification link");
    }

    await upsertProfile(
      data.user.id,
      data.user.email ?? null,
      typeof data.user.user_metadata?.display_name === "string"
        ? data.user.user_metadata.display_name
        : null,
      resolveUserRole(data.user),
    );

    const profile = await this.getProfile(data.user.id);
    return {
      user: mapAuthResponse(data.user, profile?.role ?? null),
      session: mapSession(data.session),
      message: "Email verified.",
    };
  }
}

export const authService = new AuthService();
