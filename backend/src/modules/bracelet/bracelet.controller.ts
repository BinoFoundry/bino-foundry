import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { braceletService } from "./bracelet.service.js";
import { braceletConfigIdParam, createBraceletConfigDto } from "./bracelet.validation.js";

async function createConfiguration(req: Request, res: Response): Promise<void> {
  const payload = createBraceletConfigDto.parse(req.body);
  sendCreated(res, await braceletService.createConfiguration(payload));
}

async function getConfiguration(req: Request, res: Response): Promise<void> {
  const { id } = braceletConfigIdParam.parse(req.params);
  sendJson(res, await braceletService.getConfiguration(id));
}

export const braceletHandlers = {
  createConfiguration: asyncHandler(createConfiguration),
  getConfiguration: asyncHandler(getConfiguration),
};
