import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { validateBody } from "../../lib/validation.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { spacerService } from "./spacer.service.js";
import {
  createSpacerDto,
  spacerIdParam,
  updateSpacerDto,
} from "./spacer.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await spacerService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = spacerIdParam.parse(req.params);
  sendJson(res, await spacerService.getByClientId(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const payload = validateBody(createSpacerDto, req.body);
  sendCreated(res, await spacerService.create(payload));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = spacerIdParam.parse(req.params);
  const payload = validateBody(updateSpacerDto, req.body);
  sendJson(res, await spacerService.update(id, payload));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = spacerIdParam.parse(req.params);
  sendJson(res, await spacerService.remove(id));
}

export const spacerHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
