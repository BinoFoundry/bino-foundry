import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendData, sendDataCreated, sendJson } from "../../lib/http-response.js";
import { getAuthUserId } from "../../middleware/auth-mutations.js";
import { validateBody } from "../../lib/validation.js";
import { braceletService } from "./bracelet.service.js";
import {
  braceletConfigIdParam,
  createBraceletConfigDto,
  updateBraceletStatusDto,
} from "./bracelet.validation.js";

async function createConfiguration(req: Request, res: Response): Promise<void> {
  const payload = createBraceletConfigDto.parse(req.body);
  const ownerUserId = getAuthUserId(req);
  sendCreated(res, await braceletService.createConfiguration(payload, ownerUserId));
}

async function getConfiguration(req: Request, res: Response): Promise<void> {
  const { id } = braceletConfigIdParam.parse(req.params);
  const validate = req.query.validate === "true" || req.query.validate === "1";
  sendJson(res, await braceletService.getConfiguration(id, { validateCatalog: validate }));
}

async function listConfigurations(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  sendData(req, res, await braceletService.listConfigurationsForUser(userId));
}

async function recalculatePricing(req: Request, res: Response): Promise<void> {
  const { id } = braceletConfigIdParam.parse(req.params);
  sendData(req, res, await braceletService.recalculatePricing(id));
}

async function updateStatus(req: Request, res: Response): Promise<void> {
  const { id } = braceletConfigIdParam.parse(req.params);
  const body = validateBody(updateBraceletStatusDto, req.body);
  sendData(
    req,
    res,
    await braceletService.updateStatus(id, body.status, body.orderReference),
  );
}

export const braceletHandlers = {
  createConfiguration: asyncHandler(createConfiguration),
  getConfiguration: asyncHandler(getConfiguration),
  listConfigurations: asyncHandler(listConfigurations),
  recalculatePricing: asyncHandler(recalculatePricing),
  updateStatus: asyncHandler(updateStatus),
};
