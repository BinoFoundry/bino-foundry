import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { beadTypeService } from "./bead-type.service.js";
import { listForBuilderFromQuery } from "../../lib/catalogue-list-options.js";
import {
  beadTypeIdParam,
  createBeadTypeDto,
  updateBeadTypeDto,
} from "./bead-type.validation.js";

async function list(req: Request, res: Response): Promise<void> {
  const forBuilder = listForBuilderFromQuery(req);
  sendJson(res, await beadTypeService.list({ forBuilder }));
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = beadTypeIdParam.parse(req.params);
  sendJson(res, await beadTypeService.get(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const payload = validateBody(createBeadTypeDto, req.body);
  sendCreated(res, await beadTypeService.create(payload));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = beadTypeIdParam.parse(req.params);
  const payload = validateBody(updateBeadTypeDto, req.body);
  sendJson(res, await beadTypeService.update(id, payload));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = beadTypeIdParam.parse(req.params);
  sendJson(res, await beadTypeService.remove(id));
}

export const beadTypeHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
