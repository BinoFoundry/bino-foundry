import type { EmailDeliveryStatus, PlatformEmailType } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";

export interface EmailLogRow {
  id: string;
  email_type: PlatformEmailType;
  recipient: string;
  subject: string;
  status: EmailDeliveryStatus;
  smtp_response: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateEmailLogInput {
  emailType: PlatformEmailType;
  recipient: string;
  subject: string;
  status: EmailDeliveryStatus;
  smtpResponse?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createEmailLog(input: CreateEmailLogInput): Promise<EmailLogRow | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("email_logs")
    .insert({
      email_type: input.emailType,
      recipient: input.recipient,
      subject: input.subject,
      status: input.status,
      smtp_response: input.smtpResponse ?? null,
      failure_reason: input.failureReason ?? null,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  assertNoDbError(error);
  return data as EmailLogRow;
}

/** Best-effort logging — never fail the caller when the audit table is unavailable. */
export async function safeCreateEmailLog(input: CreateEmailLogInput): Promise<void> {
  try {
    await createEmailLog(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[mail:log] Could not write email_logs row (${input.emailType} → ${input.recipient}): ${message}`,
    );
  }
}

export async function fetchLatestByStatus(status: EmailDeliveryStatus): Promise<EmailLogRow | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("email_logs")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[mail:log] Could not read email_logs: ${error.message}`);
    return null;
  }
  return (data as EmailLogRow | null) ?? null;
}

export async function fetchRecentFailures(limit = 10): Promise<EmailLogRow[]> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("email_logs")
    .select("*")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`[mail:log] Could not read email_logs failures: ${error.message}`);
    return [];
  }
  return (data as EmailLogRow[]) ?? [];
}

export async function countByTypeAndStatus(
  emailType: PlatformEmailType,
  status: EmailDeliveryStatus,
  sinceIso: string,
): Promise<number> {
  const supabase = getSupabaseServiceRole();
  const { count, error } = await supabase
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("email_type", emailType)
    .eq("status", status)
    .gte("created_at", sinceIso);

  if (error) {
    console.warn(`[mail:log] Could not count email_logs: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

export async function countByStatusSince(status: EmailDeliveryStatus, sinceIso: string): Promise<number> {
  const supabase = getSupabaseServiceRole();
  const { count, error } = await supabase
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .gte("created_at", sinceIso);

  if (error) {
    console.warn(`[mail:log] Could not count email_logs: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}
