import nodemailer from "nodemailer";

import type { SmtpEncryption } from "@bino-foundry/shared/types";

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  encryption: SmtpEncryption;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

function nodemailerSecure(encryption: SmtpEncryption): boolean {
  return encryption === "ssl" || encryption === "tls";
}

export function createSmtpTransport(config: ResolvedSmtpConfig) {
  const secure = nodemailerSecure(config.encryption);
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    auth: config.username
      ? {
          user: config.username,
          pass: config.password,
        }
      : undefined,
    requireTLS: config.encryption === "starttls",
    tls: config.encryption === "none" ? { rejectUnauthorized: false } : undefined,
  });
}

export async function verifySmtpTransport(config: ResolvedSmtpConfig): Promise<void> {
  const transport = createSmtpTransport(config);
  await transport.verify();
  transport.close();
}

export async function sendSmtpMail(
  config: ResolvedSmtpConfig,
  options: { to: string; subject: string; text: string },
): Promise<void> {
  const transport = createSmtpTransport(config);
  try {
    await transport.sendMail({
      from: formatFromAddress(config),
      to: options.to,
      subject: options.subject,
      text: options.text,
    });
  } finally {
    transport.close();
  }
}

export function formatFromAddress(config: ResolvedSmtpConfig): string {
  const email = config.fromEmail.trim();
  const name = config.fromName.trim();
  if (name) return `"${name.replace(/"/g, '\\"')}" <${email}>`;
  return email;
}

/** Map nodemailer/network errors to customer-safe test messages. */
export function classifySmtpError(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
  const responseCode =
    typeof err === "object" && err && "responseCode" in err ? Number(err.responseCode) : NaN;

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "ECONNRESET") {
    return "Unable to connect to SMTP server.";
  }
  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return "Authentication failed.";
  }
  return "Test email could not be delivered.";
}
