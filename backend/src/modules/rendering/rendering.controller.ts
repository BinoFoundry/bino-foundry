import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { RenderingService } from "./rendering.service.js";
import { frameIdParam, frameViewParams, upsertFrameViewSchema } from "./rendering.validation.js";

const service = new RenderingService();

async function getBundle(req: Request, res: Response): Promise<void> {
  const { frameId } = frameIdParam.parse(req.params);
  sendJson(res, await service.getBundle(frameId));
}

async function upsertView(req: Request, res: Response): Promise<void> {
  const { frameId, viewAxis } = frameViewParams.parse(req.params);
  const dto = validateBody(upsertFrameViewSchema, req.body);
  sendJson(res, await service.upsertView(frameId, viewAxis, dto));
}

async function removeView(req: Request, res: Response): Promise<void> {
  const { frameId, viewAxis } = frameViewParams.parse(req.params);
  sendJson(res, await service.removeView(frameId, viewAxis));
}

export const renderingHandlers = {
  getBundle: asyncHandler(getBundle),
  upsertView: asyncHandler(upsertView),
  removeView: asyncHandler(removeView),
};
