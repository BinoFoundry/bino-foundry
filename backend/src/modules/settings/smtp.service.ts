import type {
  SmtpEncryption,
  SmtpSettingsPublic,
  SmtpSettingsUpdate,
  SmtpTemplateTestRequest,
  SmtpTemplateTestType,
  SmtpTestRequest,
  SmtpTestResult,
} from "@bino-foundry/shared/types";

import {
  classifySmtpError,
  type ResolvedSmtpConfig,
  verifySmtpTransport,
} from "../../infra/mail/mail-transport.js";
import { sendPlatformMail, sendPlatformMailWithConfig } from "../../infra/mail/mail.service.js";
import {
  buildNotificationEmail,
  buildPasswordResetEmail,
  buildSmtpTestEmail,
  buildVerificationEmail,
} from "../../infra/mail/mail-templates.js";
import { resolvePublicAppUrl } from "../../config/env.js";
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
    return this.testTemplate({
      recipientEmail: payload.recipientEmail,
      templateType: "connection",
      useSaved: payload.useSaved,
      isActive: payload.isActive,
      host: payload.host,
      port: payload.port,
      encryption: payload.encryption,
      username: payload.username,
      password: payload.password,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
    });
  }

  async testTemplate(payload: SmtpTemplateTestRequest): Promise<SmtpTestResult> {
    const useSaved = payload.useSaved !== false;
    const message = this.buildTemplateMessage(payload.templateType, payload.recipientEmail.trim());
    const mailOptions = {
      emailType:
        payload.templateType === "connection"
          ? ("smtp_test" as const)
          : (payload.templateType as "verification" | "password_reset" | "notification"),
      to: payload.recipientEmail.trim(),
      subject: message.subject,
      text: message.text,
      metadata: { templateType: payload.templateType, test: true },
    };

    if (useSaved) {
      const row = await fetchRow();
      if (!row?.is_active) {
        throw new ValidationError("SMTP is not active. Enable it before testing.");
      }

      const config = await this.resolveConfigForSend(payload);
      try {
        await verifySmtpTransport(config);
      } catch (err) {
        const friendly = classifySmtpError(err);
        return {
          success: false,
          connectionOk: friendly !== "Unable to connect to SMTP server.",
          emailSent: false,
          message: friendly,
        };
      }

      const result = await sendPlatformMail(mailOptions);
      if (result.success) {
        return {
          success: true,
          connectionOk: true,
          emailSent: true,
          message: `${this.templateLabel(payload.templateType)} sent successfully.`,
        };
      }
      return {
        success: false,
        connectionOk: true,
        emailSent: false,
        message: result.error ?? "Test email could not be delivered.",
      };
    }

    const config = await this.resolveConfigForSend(payload);
    try {
      await verifySmtpTransport(config);
    } catch (err) {
      const friendly = classifySmtpError(err);
      return {
        success: false,
        connectionOk: friendly !== "Unable to connect to SMTP server.",
        emailSent: false,
        message: friendly,
      };
    }

    const result = await sendPlatformMailWithConfig(config, mailOptions);
    if (result.success) {
      return {
        success: true,
        connectionOk: true,
        emailSent: true,
        message: `${this.templateLabel(payload.templateType)} sent successfully.`,
      };
    }

    return {
      success: false,
      connectionOk: true,
      emailSent: false,
      message: result.error ?? "Test email could not be delivered.",
    };
  }

  private templateLabel(templateType: SmtpTemplateTestType): string {
    switch (templateType) {
      case "verification":
        return "Verification email";
      case "password_reset":
        return "Password reset email";
      case "notification":
        return "Notification email";
      default:
        return "SMTP test email";
    }
  }

  private buildTemplateMessage(templateType: SmtpTemplateTestType, recipientEmail: string) {
    const sampleVerifyUrl = `${resolvePublicAppUrl().replace(/\/$/, "")}/auth/callback?token=sample-verify-token&type=verify-email`;
    const sampleResetUrl = `${resolvePublicAppUrl().replace(/\/$/, "")}/auth/callback?token=sample-reset-token&type=reset-password`;

    switch (templateType) {
      case "verification":
        return buildVerificationEmail({ verifyUrl: sampleVerifyUrl, recipientName: "Test User" });
      case "password_reset":
        return buildPasswordResetEmail({ resetUrl: sampleResetUrl });
      case "notification":
        return buildNotificationEmail({
          title: "Bino Foundry notification test",
          body: `This is a sample customer notification delivered to ${recipientEmail}.`,
        });
      default:
        return buildSmtpTestEmail();
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
