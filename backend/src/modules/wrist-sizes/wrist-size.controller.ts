import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { wristSizeService } from "./wrist-size.service.js";
import { createWristSizeDto, updateWristSizeDto, wristSizeIdParam } from "./wrist-size.validation.js";

async function list(req: Request, res: Response) {
  const activeOnly = req.query.active === "1" || req.query.active === "true";
  sendJson(res, await wristSizeService.list(activeOnly));
}

async function retrieve(req: Request, res: Response) {
  const { id } = wristSizeIdParam.parse(req.params);
  sendJson(res, await wristSizeService.get(id));
}

async function create(req: Request, res: Response) {
  const payload = validateBody(createWristSizeDto, req.body);
  sendCreated(res, await wristSizeService.create(payload));
}

async function update(req: Request, res: Response) {
  const { id } = wristSizeIdParam.parse(req.params);
  const payload = validateBody(updateWristSizeDto, req.body);
  sendJson(res, await wristSizeService.update(id, payload));
}

async function remove(req: Request, res: Response) {
  const { id } = wristSizeIdParam.parse(req.params);
  sendJson(res, await wristSizeService.remove(id));
}

export const wristSizeHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
