/** Categories of platform outbound email. */
export type PlatformEmailType =
  | "smtp_test"
  | "verification"
  | "password_reset"
  | "notification"
  | "order_confirmation"
  | "order_status";

export type EmailDeliveryStatus = "sent" | "failed";

export interface EmailLogEntry {
  id: string;
  emailType: PlatformEmailType;
  recipient: string;
  subject: string;
  status: EmailDeliveryStatus;
  smtpResponse: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface EmailDeliveryStats {
  sent: number;
  failed: number;
}

import type { SmtpCredentialStorage } from "./smtp-settings.js";

export interface EmailDiagnostics {
  smtpActive: boolean;
  smtpHost: string | null;
  smtpFromEmail: string | null;
  credentialStorage: {
    username: SmtpCredentialStorage;
    password: SmtpCredentialStorage;
  };
  credentialsNeedResave: boolean;
  credentialWarning: string | null;
  lastEmailSent: EmailLogEntry | null;
  lastEmailFailure: EmailLogEntry | null;
  recentFailures: EmailLogEntry[];
  stats: {
    last24h: EmailDeliveryStats;
    verification: EmailDeliveryStats;
    passwordReset: EmailDeliveryStats;
  };
}

export type SmtpTemplateTestType = "connection" | "verification" | "password_reset" | "notification";

export interface SmtpTemplateTestRequest {
  recipientEmail: string;
  templateType: SmtpTemplateTestType;
  useSaved?: boolean;
  isActive?: boolean;
  host?: string;
  port?: number;
  encryption?: import("./smtp-settings.js").SmtpEncryption;
  username?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
}
