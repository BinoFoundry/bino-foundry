import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { subBeadTypeService } from "./sub-bead-type.service.js";
import {
  createSubBeadTypeDto,
  subBeadTypeIdParam,
  updateSubBeadTypeDto,
} from "./sub-bead-type.validation.js";

async function list(req: Request, res: Response): Promise<void> {
  const beadTypeId = typeof req.query.beadTypeId === "string" ? req.query.beadTypeId : undefined;
  sendJson(res, await subBeadTypeService.list(beadTypeId));
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = subBeadTypeIdParam.parse(req.params);
  sendJson(res, await subBeadTypeService.get(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const payload = validateBody(createSubBeadTypeDto, req.body);
  sendCreated(res, await subBeadTypeService.create(payload));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = subBeadTypeIdParam.parse(req.params);
  const payload = validateBody(updateSubBeadTypeDto, req.body);
  sendJson(res, await subBeadTypeService.update(id, payload));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = subBeadTypeIdParam.parse(req.params);
  sendJson(res, await subBeadTypeService.remove(id));
}

export const subBeadTypeHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
