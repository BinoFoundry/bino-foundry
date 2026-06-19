import type {
  SmtpCredentialStorage,
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
import {
  getEncryptionKeyFingerprint,
  maskSecretHint,
  persistSecretForStorage,
  readStoredSecret,
  type StoredSecretReadResult,
} from "../../lib/secret-cipher.js";
import { assertNoDbError } from "../../lib/supabase-db.js";

const SMTP_ROW_ID = 1;

export type SmtpMailConfigFailureReason =
  | "inactive"
  | "not_configured"
  | "invalid_credentials"
  | "incomplete";

export type SmtpMailConfigResult =
  | { ok: true; config: ResolvedSmtpConfig }
  | { ok: false; message: string; reason: SmtpMailConfigFailureReason };

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

interface RowCredentials {
  username: string;
  password: string;
  storage: { username: SmtpCredentialStorage; password: SmtpCredentialStorage };
  hasInvalid: boolean;
  needsKeyMigration: boolean;
  credentialsNeedResave: boolean;
  credentialWarning: string | null;
  credentialDecryptError: string | null;
}

function toCredentialStorage(read: StoredSecretReadResult): SmtpCredentialStorage {
  return read.storage;
}

function buildCredentialDiagnostics(
  usernameRead: StoredSecretReadResult,
  passwordRead: StoredSecretReadResult,
): Pick<
  RowCredentials,
  "hasInvalid" | "needsKeyMigration" | "credentialsNeedResave" | "credentialWarning" | "credentialDecryptError"
> {
  const hasInvalid = usernameRead.storage === "invalid" || passwordRead.storage === "invalid";
  const hasPlaintext =
    usernameRead.storage === "plaintext" || passwordRead.storage === "plaintext";
  const needsKeyMigration =
    usernameRead.needsKeyMigration === true || passwordRead.needsKeyMigration === true;

  const decryptErrors = [usernameRead, passwordRead]
    .filter((read) => read.storage === "invalid" && read.reason)
    .map((read) => read.reason!);

  let credentialWarning: string | null = null;
  if (hasInvalid) {
    credentialWarning =
      "Stored SMTP credentials could not be decrypted. Re-enter username and password, then save settings.";
  } else if (needsKeyMigration) {
    credentialWarning =
      "SMTP credentials were encrypted with a legacy key. Save settings once to re-encrypt them with the current key.";
  } else if (hasPlaintext) {
    credentialWarning =
      "SMTP credentials are stored in plaintext. Save settings once to encrypt them at rest.";
  }

  return {
    hasInvalid,
    needsKeyMigration,
    credentialsNeedResave: hasInvalid || hasPlaintext || needsKeyMigration,
    credentialWarning,
    credentialDecryptError: decryptErrors.length > 0 ? decryptErrors.join(" ") : null,
  };
}

function readRowCredentials(row: SmtpRow): RowCredentials {
  const usernameRead = readStoredSecret(row.username_ciphertext);
  const passwordRead = readStoredSecret(row.password_ciphertext);
  const diagnostics = buildCredentialDiagnostics(usernameRead, passwordRead);

  return {
    username: usernameRead.value,
    password: passwordRead.value,
    storage: {
      username: toCredentialStorage(usernameRead),
      password: toCredentialStorage(passwordRead),
    },
    ...diagnostics,
  };
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
      credentialStorage: { username: "missing", password: "missing" },
      credentialsNeedResave: false,
      credentialWarning: null,
      encryptionKeyFingerprint: getEncryptionKeyFingerprint(),
      credentialDecryptError: null,
    };
  }

  const creds = readRowCredentials(row);
  let usernameMasked: string | null = null;
  if (row.username_ciphertext) {
    const read = readStoredSecret(row.username_ciphertext);
    if (read.storage === "invalid") {
      usernameMasked = "invalid (re-save required)";
    } else if (read.value) {
      usernameMasked = maskSecretHint(read.value);
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
    credentialStorage: creds.storage,
    credentialsNeedResave: creds.credentialsNeedResave,
    credentialWarning: creds.credentialWarning,
    encryptionKeyFingerprint: getEncryptionKeyFingerprint(),
    credentialDecryptError: creds.credentialDecryptError,
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
  return {
    usernameCiphertext: persistSecretForStorage(row?.username_ciphertext, update.username),
    passwordCiphertext: persistSecretForStorage(row?.password_ciphertext, update.password),
  };
}

function requireRowCredentials(row: SmtpRow): { username: string; password: string } {
  const creds = readRowCredentials(row);
  if (creds.hasInvalid) {
    throw new ValidationError(
      creds.credentialWarning ??
        "Stored SMTP credentials are invalid. Re-enter username and password, then save settings.",
    );
  }
  return { username: creds.username, password: creds.password };
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

function mapRowSource(row: SmtpRow) {
  return {
    host: row.host,
    port: row.port,
    encryption: row.encryption,
    fromName: row.from_name,
    fromEmail: row.from_email,
  };
}

export class SmtpSettingsService {
  async getPublicSettings(): Promise<SmtpSettingsPublic> {
    return mapPublic(await fetchRow());
  }

  async updateSettings(payload: SmtpSettingsUpdate): Promise<SmtpSettingsPublic> {
    const existing = await fetchRow();
    const existingCreds = existing ? readRowCredentials(existing) : null;

    if (existingCreds?.hasInvalid) {
      const hasUsername = Boolean(payload.username?.trim());
      const hasPassword = Boolean(payload.password?.trim());
      if (!hasUsername || !hasPassword) {
        throw new ValidationError(
          "Stored SMTP credentials are invalid. Enter both username and password, then save settings.",
        );
      }
    }

    const keyFingerprint = getEncryptionKeyFingerprint();
    const { usernameCiphertext, passwordCiphertext } = resolveCredentials(existing, payload);

    if (existingCreds?.needsKeyMigration && !existingCreds.hasInvalid) {
      console.info(
        `[smtp] Re-encrypting credentials with current key (${keyFingerprint}) after legacy-key migration`,
      );
    }

    if (usernameCiphertext || passwordCiphertext) {
      console.info(
        `[smtp] Persisting credentials (key=${keyFingerprint}, username=${usernameCiphertext ? "set" : "empty"}, password=${passwordCiphertext ? "set" : "empty"})`,
      );
    }

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

  /** Resolve active SMTP for outbound mail — never throws. */
  async resolveActiveMailConfig(): Promise<SmtpMailConfigResult> {
    try {
      const row = await fetchRow();
      if (!row) {
        return {
          ok: false,
          message: "SMTP is not configured",
          reason: "not_configured",
        };
      }
      if (!row.is_active) {
        return {
          ok: false,
          message: "SMTP is not active",
          reason: "inactive",
        };
      }

      const creds = readRowCredentials(row);
      if (creds.hasInvalid) {
        return {
          ok: false,
          message:
            creds.credentialWarning ??
            "Stored SMTP credentials are invalid. Re-enter credentials in General Settings and save.",
          reason: "invalid_credentials",
        };
      }

      const config = toResolvedConfig(mapRowSource(row), {
        username: creds.username,
        password: creds.password,
      });

      if (!config.host || !config.fromEmail) {
        return {
          ok: false,
          message: "SMTP host and sender email are required",
          reason: "incomplete",
        };
      }

      return { ok: true, config };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load SMTP configuration";
      console.warn(`[smtp] resolveActiveMailConfig failed: ${message}`);
      return {
        ok: false,
        message: "SMTP configuration could not be loaded. Check General Settings.",
        reason: "not_configured",
      };
    }
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

    const stored = row ? requireRowCredentials(row) : { username: "", password: "" };
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
    try {
      return await this.runTemplateTest(payload);
    } catch (err) {
      if (err instanceof ValidationError) {
        return {
          success: false,
          connectionOk: false,
          emailSent: false,
          message: err.message,
        };
      }
      throw err;
    }
  }

  private async runTemplateTest(payload: SmtpTemplateTestRequest): Promise<SmtpTestResult> {
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

  /** Loads active persisted SMTP config for outbound mail. Never throws. */
  async getActiveMailConfig(): Promise<ResolvedSmtpConfig | null> {
    const resolved = await this.resolveActiveMailConfig();
    if (!resolved.ok) {
      console.warn(`[smtp] ${resolved.message}`);
      return null;
    }
    return resolved.config;
  }
}

export const smtpSettingsService = new SmtpSettingsService();
