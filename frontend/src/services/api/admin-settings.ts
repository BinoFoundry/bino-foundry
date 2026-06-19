import type {
  EmailDiagnostics,
  SmtpSettingsPublic,
  SmtpSettingsUpdate,
  SmtpTemplateTestRequest,
  SmtpTestRequest,
  SmtpTestResult,
} from "@bino-foundry/shared/types";

import { apiRequest } from "./client";

export const adminSettingsApi = {
  getSmtp(): Promise<SmtpSettingsPublic> {
    return apiRequest<SmtpSettingsPublic>("/admin/settings/smtp");
  },

  updateSmtp(settings: SmtpSettingsUpdate): Promise<SmtpSettingsPublic> {
    return apiRequest<SmtpSettingsPublic>("/admin/settings/smtp", {
      method: "PUT",
      body: settings,
    });
  },

  testSmtp(payload: SmtpTestRequest): Promise<SmtpTestResult> {
    return apiRequest<SmtpTestResult>("/admin/settings/smtp/test", {
      method: "POST",
      body: payload,
    });
  },

  testSmtpTemplate(payload: SmtpTemplateTestRequest): Promise<SmtpTestResult> {
    return apiRequest<SmtpTestResult>("/admin/settings/smtp/test-template", {
      method: "POST",
      body: payload,
    });
  },

  getEmailDiagnostics(): Promise<EmailDiagnostics> {
    return apiRequest<EmailDiagnostics>("/admin/settings/email-diagnostics");
  },
};
