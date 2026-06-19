import type { EmailDiagnostics, EmailLogEntry } from "@bino-foundry/shared/types";

import {
  countByStatusSince,
  countByTypeAndStatus,
  fetchLatestByStatus,
  fetchRecentFailures,
  type EmailLogRow,
} from "../../infra/mail/email-log.repository.js";
import { smtpSettingsService } from "./smtp.service.js";

function mapLogRow(row: EmailLogRow | null): EmailLogEntry | null {
  if (!row) return null;
  return {
    id: row.id,
    emailType: row.email_type,
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    smtpResponse: row.smtp_response,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

export class EmailDiagnosticsService {
  async getDiagnostics(): Promise<EmailDiagnostics> {
    const smtp = await smtpSettingsService.getPublicSettings();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      lastSent,
      lastFailed,
      recentFailures,
      sent24h,
      failed24h,
      verificationSent,
      verificationFailed,
      resetSent,
      resetFailed,
    ] = await Promise.all([
      fetchLatestByStatus("sent"),
      fetchLatestByStatus("failed"),
      fetchRecentFailures(8),
      countByStatusSince("sent", since24h),
      countByStatusSince("failed", since24h),
      countByTypeAndStatus("verification", "sent", since24h),
      countByTypeAndStatus("verification", "failed", since24h),
      countByTypeAndStatus("password_reset", "sent", since24h),
      countByTypeAndStatus("password_reset", "failed", since24h),
    ]);

    return {
      smtpActive: smtp.isActive,
      smtpHost: smtp.host || null,
      smtpFromEmail: smtp.fromEmail || null,
      credentialStorage: smtp.credentialStorage,
      credentialsNeedResave: smtp.credentialsNeedResave,
      credentialWarning: smtp.credentialWarning,
      lastEmailSent: mapLogRow(lastSent),
      lastEmailFailure: mapLogRow(lastFailed),
      recentFailures: recentFailures.map((row) => mapLogRow(row)!),
      stats: {
        last24h: { sent: sent24h, failed: failed24h },
        verification: { sent: verificationSent, failed: verificationFailed },
        passwordReset: { sent: resetSent, failed: resetFailed },
      },
    };
  }
}

export const emailDiagnosticsService = new EmailDiagnosticsService();
