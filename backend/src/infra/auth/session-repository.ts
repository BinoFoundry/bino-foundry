import { getSupabaseServiceRole } from "../supabase/adminClient.js";
import { generateOpaqueToken, hashOpaqueToken } from "../../lib/crypto-token.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { getEnv } from "../../config/env.js";

export interface CreatedSession {
  refreshToken: string;
  sessionId: string;
  expiresAt: string;
}

function refreshTtlMs(): number {
  return getEnv().JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export async function createUserSession(
  userId: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<CreatedSession> {
  const refreshToken = generateOpaqueToken();
  const refreshTokenHash = hashOpaqueToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshTtlMs()).toISOString();

  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      refresh_token_hash: refreshTokenHash,
      expires_at: expiresAt,
      user_agent: meta?.userAgent ?? null,
      ip_address: meta?.ipAddress ?? null,
    })
    .select("id")
    .single();

  assertNoDbError(error);
  return {
    refreshToken,
    sessionId: String(data.id),
    expiresAt,
  };
}

export async function findActiveSessionByRefreshToken(refreshToken: string): Promise<{
  sessionId: string;
  userId: string;
  expiresAt: string;
} | null> {
  const supabase = getSupabaseServiceRole();
  const tokenHash = hashOpaqueToken(refreshToken);
  const { data, error } = await supabase
    .from("user_sessions")
    .select("id, user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", tokenHash)
    .maybeSingle();

  assertNoDbError(error);
  if (!data || data.revoked_at) return null;
  if (new Date(String(data.expires_at)).getTime() <= Date.now()) return null;

  return {
    sessionId: String(data.id),
    userId: String(data.user_id),
    expiresAt: String(data.expires_at),
  };
}

export async function revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
  const supabase = getSupabaseServiceRole();
  const tokenHash = hashOpaqueToken(refreshToken);
  const { error } = await supabase
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("refresh_token_hash", tokenHash);

  assertNoDbError(error);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);

  assertNoDbError(error);
}

export async function rotateUserSession(
  sessionId: string,
  userId: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<CreatedSession> {
  const supabase = getSupabaseServiceRole();
  const { error: revokeError } = await supabase
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId);

  assertNoDbError(revokeError);
  return createUserSession(userId, meta);
}
