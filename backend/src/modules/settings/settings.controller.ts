import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendJson } from "../../lib/http-response.js";
import { settingsService } from "./settings.service.js";
import { siteGeneralSettingsDto, strandRenderDefaultsDto } from "./settings.validation.js";

async function getGeneralSettings(_req: Request, res: Response): Promise<void> {
  sendJson(res, await settingsService.getGeneralSettings());
}

async function updateGeneralSettings(req: Request, res: Response): Promise<void> {
  const payload = siteGeneralSettingsDto.parse(req.body);
  sendJson(res, await settingsService.updateGeneralSettings(payload));
}

async function getStrandRenderDefaults(_req: Request, res: Response): Promise<void> {
  sendJson(res, await settingsService.getStrandRenderDefaults());
}

async function updateStrandRenderDefaults(req: Request, res: Response): Promise<void> {
  const payload = strandRenderDefaultsDto.parse(req.body);
  sendJson(res, await settingsService.updateStrandRenderDefaults(payload));
}

export const settingsHandlers = {
  getGeneralSettings: asyncHandler(getGeneralSettings),
  updateGeneralSettings: asyncHandler(updateGeneralSettings),
  getStrandRenderDefaults: asyncHandler(getStrandRenderDefaults),
  updateStrandRenderDefaults: asyncHandler(updateStrandRenderDefaults),
};
