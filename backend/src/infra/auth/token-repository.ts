import { getSupabaseServiceRole } from "../supabase/adminClient.js";
import { generateOpaqueToken, hashOpaqueToken } from "../../lib/crypto-token.js";
import { assertNoDbError } from "../../lib/supabase-db.js";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

async function invalidateExistingTokens(table: "password_reset_tokens" | "email_verification_tokens", userId: string) {
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from(table)
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);

  assertNoDbError(error);
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  await invalidateExistingTokens("password_reset_tokens", userId);
  const token = generateOpaqueToken();
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: hashOpaqueToken(token),
    expires_at: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
  });
  assertNoDbError(error);
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const supabase = getSupabaseServiceRole();
  const tokenHash = hashOpaqueToken(token);
  const { data, error } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  assertNoDbError(error);
  if (!data || data.used_at) return null;
  if (new Date(String(data.expires_at)).getTime() <= Date.now()) return null;

  const { error: useError } = await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);

  assertNoDbError(useError);
  return String(data.user_id);
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  await invalidateExistingTokens("email_verification_tokens", userId);
  const token = generateOpaqueToken();
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase.from("email_verification_tokens").insert({
    user_id: userId,
    token_hash: hashOpaqueToken(token),
    expires_at: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString(),
  });
  assertNoDbError(error);
  return token;
}

export async function consumeEmailVerificationToken(token: string): Promise<string | null> {
  const supabase = getSupabaseServiceRole();
  const tokenHash = hashOpaqueToken(token);
  const { data, error } = await supabase
    .from("email_verification_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  assertNoDbError(error);
  if (!data || data.used_at) return null;
  if (new Date(String(data.expires_at)).getTime() <= Date.now()) return null;

  const { error: useError } = await supabase
    .from("email_verification_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);

  assertNoDbError(useError);
  return String(data.user_id);
}
