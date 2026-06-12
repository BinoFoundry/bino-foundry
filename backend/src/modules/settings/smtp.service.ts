import type {
  SmtpEncryption,
  SmtpSettingsPublic,
  SmtpSettingsUpdate,
  SmtpTestRequest,
  SmtpTestResult,
} from "@bino-foundry/shared/types";

import {
  classifySmtpError,
  formatFromAddress,
  type ResolvedSmtpConfig,
  sendSmtpMail,
  verifySmtpTransport,
} from "../../infra/mail/mail-transport.js";
import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ValidationError } from "../../lib/errors.js";
import { decryptSecret, encryptSecret, maskSecretHint } from "../../lib/secret-cipher.js";
import { assertNoDbError } from "../../lib/supabase-db.js";

const SMTP_ROW_ID = 1;

interface SmtpRow {
  is_active: boolean;
  host: string;
  port: number;
  encryption: SmtpEncryption;
  username_ciphertext: string | null;
  password_ciphertext: string | null;
  from_name: string;
  from_email: string;
  updated_at: string;
}

function mapPublic(row: SmtpRow | null): SmtpSettingsPublic {
  if (!row) {
    return {
      isActive: false,
      host: "",
      port: 587,
      encryption: "starttls",
      usernameMasked: null,
      hasPassword: false,
      fromName: "",
      fromEmail: "",
      updatedAt: null,
    };
  }

  let usernameMasked: string | null = null;
  if (row.username_ciphertext) {
    try {
      usernameMasked = maskSecretHint(decryptSecret(row.username_ciphertext));
    } catch {
      usernameMasked = "••••••••";
    }
  }

  return {
    isActive: row.is_active,
    host: row.host ?? "",
    port: row.port ?? 587,
    encryption: row.encryption ?? "starttls",
    usernameMasked,
    hasPassword: Boolean(row.password_ciphertext),
    fromName: row.from_name ?? "",
    fromEmail: row.from_email ?? "",
    updatedAt: row.updated_at ?? null,
  };
}

async function fetchRow(): Promise<SmtpRow | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("smtp_settings")
    .select(
      "is_active, host, port, encryption, username_ciphertext, password_ciphertext, from_name, from_email, updated_at",
    )
    .eq("id", SMTP_ROW_ID)
    .maybeSingle();

  assertNoDbError(error);
  return (data as SmtpRow | null) ?? null;
}

function resolveCredentials(
  row: SmtpRow | null,
  update: Pick<SmtpSettingsUpdate, "username" | "password">,
): { usernameCiphertext: string | null; passwordCiphertext: string | null } {
  const usernameRaw = update.username?.trim();
  const passwordRaw = update.password?.trim();

  let usernameCiphertext = row?.username_ciphertext ?? null;
  let passwordCiphertext = row?.password_ciphertext ?? null;

  if (usernameRaw) {
    usernameCiphertext = encryptSecret(usernameRaw);
  }
  if (passwordRaw) {
    passwordCiphertext = encryptSecret(passwordRaw);
  }

  return { usernameCiphertext, passwordCiphertext };
}

function decryptRowCredentials(row: SmtpRow): { username: string; password: string } {
  let username = "";
  let password = "";

  if (row.username_ciphertext) {
    username = decryptSecret(row.username_ciphertext);
  }
  if (row.password_ciphertext) {
    password = decryptSecret(row.password_ciphertext);
  }

  return { username, password };
}

function toResolvedConfig(
  source: {
    host: string;
    port: number;
    encryption: SmtpEncryption;
    fromName: string;
    fromEmail: string;
  },
  credentials: { username: string; password: string },
): ResolvedSmtpConfig {
  return {
    host: source.host.trim(),
    port: source.port,
    encryption: source.encryption,
    username: credentials.username,
    password: credentials.password,
    fromName: source.fromName.trim(),
    fromEmail: source.fromEmail.trim(),
  };
}

function assertSendableConfig(config: ResolvedSmtpConfig): void {
  if (!config.host) throw new ValidationError("SMTP host is required");
  if (!config.fromEmail) throw new ValidationError("Sender email is required");
}

export class SmtpSettingsService {
  async getPublicSettings(): Promise<SmtpSettingsPublic> {
    return mapPublic(await fetchRow());
  }

  async updateSettings(payload: SmtpSettingsUpdate): Promise<SmtpSettingsPublic> {
    const existing = await fetchRow();
    const { usernameCiphertext, passwordCiphertext } = resolveCredentials(existing, payload);

    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("smtp_settings")
      .upsert(
        {
          id: SMTP_ROW_ID,
          is_active: payload.isActive,
          host: payload.host.trim(),
          port: payload.port,
          encryption: payload.encryption,
          username_ciphertext: usernameCiphertext,
          password_ciphertext: passwordCiphertext,
          from_name: payload.fromName.trim(),
          from_email: payload.fromEmail.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select(
        "is_active, host, port, encryption, username_ciphertext, password_ciphertext, from_name, from_email, updated_at",
      )
      .single();

    assertNoDbError(error);
    return mapPublic(data as SmtpRow);
  }

  async resolveConfigForSend(overrides?: Partial<SmtpTestRequest>): Promise<ResolvedSmtpConfig> {
    const row = await fetchRow();
    const useSaved = overrides?.useSaved !== false;

    if (!row && useSaved) {
      throw new ValidationError("SMTP is not configured yet");
    }

    const source = useSaved
      ? {
          host: row!.host,
          port: row!.port,
          encryption: row!.encryption,
          fromName: row!.from_name,
          fromEmail: row!.from_email,
        }
      : {
          host: overrides?.host ?? "",
          port: overrides?.port ?? 587,
          encryption: overrides?.encryption ?? "starttls",
          fromName: overrides?.fromName ?? "",
          fromEmail: overrides?.fromEmail ?? "",
        };

    const stored = row ? decryptRowCredentials(row) : { username: "", password: "" };
    const credentials = {
      username: overrides?.username?.trim() || stored.username,
      password: overrides?.password?.trim() || stored.password,
    };

    const config = toResolvedConfig(source, credentials);
    assertSendableConfig(config);
    return config;
  }

  async testSettings(payload: SmtpTestRequest): Promise<SmtpTestResult> {
    const useSaved = payload.useSaved !== false;
    const config = await this.resolveConfigForSend(payload);

    if (useSaved) {
      const row = await fetchRow();
      if (!row?.is_active) {
        throw new ValidationError("SMTP is not active. Enable it before testing.");
      }
    }

    const subject = "Bino Foundry SMTP Test";
    const text =
      "This is a test email generated from your Bino Foundry SMTP configuration. If you received this message, your email settings are working correctly.";

    try {
      await verifySmtpTransport(config);
      await sendSmtpMail(config, {
        to: payload.recipientEmail.trim(),
        subject,
        text,
      });

      return {
        success: true,
        connectionOk: true,
        emailSent: true,
        message: "SMTP connection successful. Test email sent successfully.",
      };
    } catch (err) {
      const friendly = classifySmtpError(err);
      const connectionFailed = friendly === "Unable to connect to SMTP server.";
      return {
        success: false,
        connectionOk: !connectionFailed,
        emailSent: false,
        message: friendly,
      };
    }
  }

  /** For future mail features — loads active persisted SMTP config. */
  async getActiveMailConfig(): Promise<ResolvedSmtpConfig | null> {
    const row = await fetchRow();
    if (!row?.is_active) return null;
    const config = toResolvedConfig(mapRowSource(row), decryptRowCredentials(row));
    if (!config.host || !config.fromEmail) return null;
    return config;
  }
}

function mapRowSource(row: SmtpRow) {
  return {
    host: row.host,
    port: row.port,
    encryption: row.encryption,
    fromName: row.from_name,
    fromEmail: row.from_email,
  };
}

export const smtpSettingsService = new SmtpSettingsService();
