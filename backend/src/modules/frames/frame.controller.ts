import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { frameService } from "./frame.service.js";
import {
  frameCreateDto,
  frameIdParam,
  frameUpdateDto,
} from "./frame.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await frameService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = frameIdParam.parse(req.params);
  sendJson(res, await frameService.getById(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const dto = validateBody(frameCreateDto, req.body);
  sendCreated(res, await frameService.create(dto));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = frameIdParam.parse(req.params);
  const dto = validateBody(frameUpdateDto, req.body);
  sendJson(res, await frameService.update(id, dto));
}

async function references(req: Request, res: Response): Promise<void> {
  const { id } = frameIdParam.parse(req.params);
  sendJson(res, await frameService.countDesignReferences(id));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = frameIdParam.parse(req.params);
  const force = req.query.force === "1" || req.query.force === "true";
  sendJson(res, await frameService.remove(id, { force }));
}

export const frameHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  references: asyncHandler(references),
  remove: asyncHandler(remove),
};
