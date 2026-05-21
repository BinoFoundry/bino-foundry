import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { charmTypeService } from "./charm-type.service.js";
import {
  charmTypeCreateDto,
  charmTypeIdParam,
  charmTypeUpdateDto,
} from "./charm-type.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await charmTypeService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = charmTypeIdParam.parse(req.params);
  sendJson(res, await charmTypeService.get(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const dto = validateBody(charmTypeCreateDto, req.body);
  sendCreated(res, await charmTypeService.create(dto));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = charmTypeIdParam.parse(req.params);
  const dto = validateBody(charmTypeUpdateDto, req.body);
  sendJson(res, await charmTypeService.update(id, dto));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = charmTypeIdParam.parse(req.params);
  sendJson(res, await charmTypeService.remove(id));
}

export const charmTypeHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
