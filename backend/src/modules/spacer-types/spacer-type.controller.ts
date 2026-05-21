import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { spacerTypeService } from "./spacer-type.service.js";
import {
  spacerTypeCreateDto,
  spacerTypeIdParam,
  spacerTypeUpdateDto,
} from "./spacer-type.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await spacerTypeService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = spacerTypeIdParam.parse(req.params);
  sendJson(res, await spacerTypeService.get(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const dto = validateBody(spacerTypeCreateDto, req.body);
  sendCreated(res, await spacerTypeService.create(dto));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = spacerTypeIdParam.parse(req.params);
  const dto = validateBody(spacerTypeUpdateDto, req.body);
  sendJson(res, await spacerTypeService.update(id, dto));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = spacerTypeIdParam.parse(req.params);
  sendJson(res, await spacerTypeService.remove(id));
}

export const spacerTypeHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
