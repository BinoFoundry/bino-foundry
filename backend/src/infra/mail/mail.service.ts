import { smtpSettingsService } from "../../modules/settings/smtp.service.js";
import { sendSmtpMail } from "./mail-transport.js";

export interface PlatformMailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Send a platform email using the active database SMTP configuration.
 * Future auth/transactional features should call this rather than nodemailer directly.
 */
export async function sendPlatformMail(message: PlatformMailMessage): Promise<void> {
  const config = await smtpSettingsService.getActiveMailConfig();
  if (!config) {
    throw new Error("SMTP is not configured or not active");
  }
  await sendSmtpMail(config, message);
}
