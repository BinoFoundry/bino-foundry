import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { typeCatalogService } from "./type.service.js";
import {
  typeCreateDto,
  typeIdParam,
  typeUpdateDto,
} from "./type.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await typeCatalogService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = typeIdParam.parse(req.params);
  sendJson(res, await typeCatalogService.get(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const dto = validateBody(typeCreateDto, req.body);
  sendCreated(res, await typeCatalogService.create(dto));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = typeIdParam.parse(req.params);
  const dto = validateBody(typeUpdateDto, req.body);
  sendJson(res, await typeCatalogService.update(id, dto));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = typeIdParam.parse(req.params);
  sendJson(res, await typeCatalogService.remove(id));
}

export const typeHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
