import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { tagService } from "./tag.service.js";
import { createTagDto, tagIdParam } from "./tag.validation.js";

async function list(_req: Request, res: Response) {
  sendJson(res, await tagService.list());
}

async function create(req: Request, res: Response) {
  const { name } = validateBody(createTagDto, req.body);
  sendCreated(res, await tagService.create(name));
}

async function remove(req: Request, res: Response) {
  const { id } = tagIdParam.parse(req.params);
  sendJson(res, await tagService.remove(id));
}

export const tagHandlers = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  remove: asyncHandler(remove),
};
