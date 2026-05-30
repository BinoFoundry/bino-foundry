import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { braceletService } from "./bracelet.service.js";
import {
  braceletConfigIdParam,
  braceletPricingRulesDto,
  createBraceletConfigDto,
} from "./bracelet.validation.js";

async function getPricingRules(_req: Request, res: Response): Promise<void> {
  sendJson(res, await braceletService.getPricingRules());
}

async function updatePricingRules(req: Request, res: Response): Promise<void> {
  const payload = braceletPricingRulesDto.parse(req.body);
  sendJson(res, await braceletService.updatePricingRules(payload));
}

async function createConfiguration(req: Request, res: Response): Promise<void> {
  const payload = createBraceletConfigDto.parse(req.body);
  sendCreated(res, await braceletService.createConfiguration(payload));
}

async function getConfiguration(req: Request, res: Response): Promise<void> {
  const { id } = braceletConfigIdParam.parse(req.params);
  sendJson(res, await braceletService.getConfiguration(id));
}

export const braceletHandlers = {
  getPricingRules: asyncHandler(getPricingRules),
  updatePricingRules: asyncHandler(updatePricingRules),
  createConfiguration: asyncHandler(createConfiguration),
  getConfiguration: asyncHandler(getConfiguration),
};
