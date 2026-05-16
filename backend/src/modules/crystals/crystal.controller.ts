import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { validateBody } from "../../lib/validation.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { crystalService } from "./crystal.service.js";
import {
  createCrystalDto,
  crystalIdParam,
  updateCrystalDto,
} from "./crystal.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await crystalService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = crystalIdParam.parse(req.params);
  sendJson(res, await crystalService.getByClientId(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const payload = validateBody(createCrystalDto, req.body);
  sendCreated(res, await crystalService.create(payload));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = crystalIdParam.parse(req.params);
  const payload = validateBody(updateCrystalDto, req.body);
  sendJson(res, await crystalService.update(id, payload));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = crystalIdParam.parse(req.params);
  sendJson(res, await crystalService.remove(id));
}

export const crystalHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
