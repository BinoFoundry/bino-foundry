import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { validateBody } from "../../lib/validation.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { charmService } from "./charm.service.js";
import {
  charmIdParam,
  createCharmDto,
  updateCharmDto,
} from "./charm.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await charmService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = charmIdParam.parse(req.params);
  sendJson(res, await charmService.getByClientId(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const payload = validateBody(createCharmDto, req.body);
  sendCreated(res, await charmService.create(payload));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = charmIdParam.parse(req.params);
  const payload = validateBody(updateCharmDto, req.body);
  sendJson(res, await charmService.update(id, payload));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = charmIdParam.parse(req.params);
  sendJson(res, await charmService.remove(id));
}

export const charmHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
