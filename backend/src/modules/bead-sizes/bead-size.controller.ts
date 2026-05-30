import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { beadSizeService } from "./bead-size.service.js";
import { beadSizeIdParam, createBeadSizeDto, updateBeadSizeDto } from "./bead-size.validation.js";

async function list(req: Request, res: Response) {
  const activeOnly = req.query.active === "1" || req.query.active === "true";
  sendJson(res, await beadSizeService.list(activeOnly));
}

async function retrieve(req: Request, res: Response) {
  const { id } = beadSizeIdParam.parse(req.params);
  sendJson(res, await beadSizeService.get(id));
}

async function create(req: Request, res: Response) {
  const payload = validateBody(createBeadSizeDto, req.body);
  sendCreated(res, await beadSizeService.create(payload));
}

async function update(req: Request, res: Response) {
  const { id } = beadSizeIdParam.parse(req.params);
  const payload = validateBody(updateBeadSizeDto, req.body);
  sendJson(res, await beadSizeService.update(id, payload));
}

async function remove(req: Request, res: Response) {
  const { id } = beadSizeIdParam.parse(req.params);
  sendJson(res, await beadSizeService.remove(id));
}

export const beadSizeHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
