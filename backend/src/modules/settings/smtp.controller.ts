import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendJson } from "../../lib/http-response.js";
import { smtpSettingsService } from "./smtp.service.js";
import { smtpSettingsUpdateDto, smtpTemplateTestDto, smtpTestDto } from "./smtp.validation.js";

async function getSmtpSettings(_req: Request, res: Response): Promise<void> {
  sendJson(res, await smtpSettingsService.getPublicSettings());
}

async function updateSmtpSettings(req: Request, res: Response): Promise<void> {
  const payload = smtpSettingsUpdateDto.parse(req.body);
  sendJson(res, await smtpSettingsService.updateSettings(payload));
}

async function testSmtpSettings(req: Request, res: Response): Promise<void> {
  const payload = smtpTestDto.parse(req.body);
  sendJson(res, await smtpSettingsService.testSettings(payload));
}

async function testSmtpTemplate(req: Request, res: Response): Promise<void> {
  const payload = smtpTemplateTestDto.parse(req.body);
  sendJson(res, await smtpSettingsService.testTemplate(payload));
}

export const smtpHandlers = {
  getSmtpSettings: asyncHandler(getSmtpSettings),
  updateSmtpSettings: asyncHandler(updateSmtpSettings),
  testSmtpSettings: asyncHandler(testSmtpSettings),
  testSmtpTemplate: asyncHandler(testSmtpTemplate),
};
