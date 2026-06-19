const APP_NAME = "Bino Foundry";

export function buildVerificationEmail(params: {
  verifyUrl: string;
  recipientName?: string | null;
}): { subject: string; text: string } {
  const greeting = params.recipientName?.trim() ? `Hi ${params.recipientName.trim()},` : "Hi,";
  return {
    subject: `Verify your ${APP_NAME} account`,
    text: [
      greeting,
      "",
      `Thanks for registering with ${APP_NAME}. Please verify your email address by opening the link below:`,
      "",
      params.verifyUrl,
      "",
      "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
      "",
      `— ${APP_NAME}`,
    ].join("\n"),
  };
}

export function buildPasswordResetEmail(params: { resetUrl: string }): { subject: string; text: string } {
  return {
    subject: `Reset your ${APP_NAME} password`,
    text: [
      "Hi,",
      "",
      "We received a request to reset your password. Open the link below to choose a new password:",
      "",
      params.resetUrl,
      "",
      "This link expires in 1 hour. If you did not request a reset, you can ignore this email.",
      "",
      `— ${APP_NAME}`,
    ].join("\n"),
  };
}

export function buildNotificationEmail(params: {
  title: string;
  body: string;
}): { subject: string; text: string } {
  return {
    subject: params.title,
    text: [params.body, "", `— ${APP_NAME}`].join("\n"),
  };
}

export function buildSmtpTestEmail(): { subject: string; text: string } {
  return {
    subject: `${APP_NAME} SMTP Test`,
    text: `This is a test email generated from your ${APP_NAME} SMTP configuration. If you received this message, your email settings are working correctly.`,
  };
}
