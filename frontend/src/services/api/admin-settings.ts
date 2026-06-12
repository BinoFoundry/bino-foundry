import type {
  SmtpSettingsPublic,
  SmtpSettingsUpdate,
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
};
