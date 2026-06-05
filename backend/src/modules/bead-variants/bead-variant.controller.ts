import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { beadVariantService } from "./bead-variant.service.js";
import {
  beadVariantIdParam,
  createBeadVariantDto,
  updateBeadVariantDto,
} from "./bead-variant.validation.js";

async function list(req: Request, res: Response) {
  const activeOnly = req.query.active === "1" || req.query.active === "true";
  const libraryId = typeof req.query.libraryId === "string" ? req.query.libraryId : undefined;
  sendJson(res, await beadVariantService.list({ activeOnly, libraryId }));
}

async function retrieve(req: Request, res: Response) {
  const { id } = beadVariantIdParam.parse(req.params);
  sendJson(res, await beadVariantService.get(id));
}

async function create(req: Request, res: Response) {
  const payload = validateBody(createBeadVariantDto, req.body);
  sendCreated(res, await beadVariantService.create(payload));
}

async function update(req: Request, res: Response) {
  const { id } = beadVariantIdParam.parse(req.params);
  const payload = validateBody(updateBeadVariantDto, req.body);
  sendJson(res, await beadVariantService.update(id, payload));
}

async function remove(req: Request, res: Response) {
  const { id } = beadVariantIdParam.parse(req.params);
  sendJson(res, await beadVariantService.remove(id));
}

export const beadVariantHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
