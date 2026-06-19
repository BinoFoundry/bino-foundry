import type { PlatformEmailType } from "@bino-foundry/shared/types";

import { smtpSettingsService } from "../../modules/settings/smtp.service.js";
import { classifySmtpError, sendSmtpMail, type ResolvedSmtpConfig } from "./mail-transport.js";
import { createEmailLog } from "./email-log.repository.js";

export interface PlatformMailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface SendPlatformMailOptions extends PlatformMailMessage {
  emailType: PlatformEmailType;
  metadata?: Record<string, unknown>;
}

export interface SendPlatformMailResult {
  success: boolean;
  messageId?: string;
  smtpResponse?: string;
  error?: string;
}

function logMailEvent(
  level: "info" | "error",
  emailType: PlatformEmailType,
  recipient: string,
  detail: string,
): void {
  const prefix = `[mail:${emailType}]`;
  if (level === "info") {
    console.info(`${prefix} sent to ${recipient} — ${detail}`);
  } else {
    console.error(`${prefix} failed for ${recipient} — ${detail}`);
  }
}

/**
 * Send using an explicit SMTP config (admin inline tests before save).
 */
export async function sendPlatformMailWithConfig(
  config: ResolvedSmtpConfig,
  options: SendPlatformMailOptions,
): Promise<SendPlatformMailResult> {
  try {
    const delivery = await sendSmtpMail(config, {
      to: options.to,
      subject: options.subject,
      text: options.text,
    });

    await createEmailLog({
      emailType: options.emailType,
      recipient: options.to,
      subject: options.subject,
      status: "sent",
      smtpResponse: delivery.response ?? delivery.messageId ?? "accepted",
      metadata: { ...options.metadata, inlineConfig: true },
    });

    logMailEvent(
      "info",
      options.emailType,
      options.to,
      delivery.response ?? delivery.messageId ?? "accepted",
    );

    return {
      success: true,
      messageId: delivery.messageId,
      smtpResponse: delivery.response,
    };
  } catch (err) {
    const friendly = classifySmtpError(err);
    const technical =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown SMTP error";

    await createEmailLog({
      emailType: options.emailType,
      recipient: options.to,
      subject: options.subject,
      status: "failed",
      failureReason: technical,
      metadata: { ...options.metadata, friendlyError: friendly, inlineConfig: true },
    });

    logMailEvent("error", options.emailType, options.to, `${friendly} (${technical})`);
    return { success: false, error: friendly };
  }
}

/**
 * Send a platform email using the active database SMTP configuration.
 * All auth and transactional features must call this rather than nodemailer directly.
 */
export async function sendPlatformMail(options: SendPlatformMailOptions): Promise<SendPlatformMailResult> {
  const config = await smtpSettingsService.getActiveMailConfig();
  if (!config) {
    const error = "SMTP is not configured or not active";
    await createEmailLog({
      emailType: options.emailType,
      recipient: options.to,
      subject: options.subject,
      status: "failed",
      failureReason: error,
      metadata: options.metadata,
    });
    logMailEvent("error", options.emailType, options.to, error);
    return { success: false, error };
  }

  try {
    const delivery = await sendSmtpMail(config, {
      to: options.to,
      subject: options.subject,
      text: options.text,
    });

    await createEmailLog({
      emailType: options.emailType,
      recipient: options.to,
      subject: options.subject,
      status: "sent",
      smtpResponse: delivery.response ?? delivery.messageId ?? "accepted",
      metadata: options.metadata,
    });

    logMailEvent(
      "info",
      options.emailType,
      options.to,
      delivery.response ?? delivery.messageId ?? "accepted",
    );

    return {
      success: true,
      messageId: delivery.messageId,
      smtpResponse: delivery.response,
    };
  } catch (err) {
    const friendly = classifySmtpError(err);
    const technical =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown SMTP error";

    await createEmailLog({
      emailType: options.emailType,
      recipient: options.to,
      subject: options.subject,
      status: "failed",
      failureReason: technical,
      metadata: { ...options.metadata, friendlyError: friendly },
    });

    logMailEvent("error", options.emailType, options.to, `${friendly} (${technical})`);
    return { success: false, error: friendly };
  }
}
