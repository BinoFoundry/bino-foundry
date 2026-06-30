import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { beadLibraryService } from "./bead-library.service.js";
import {
  beadLibraryCompleteSaveSchema,
  beadLibraryCropDto,
  beadLibraryIdParam,
  createBeadLibraryDto,
  updateBeadLibraryDto,
} from "./bead-library.validation.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await beadLibraryService.list());
}

async function retrieve(req: Request, res: Response): Promise<void> {
  const { id } = beadLibraryIdParam.parse(req.params);
  sendJson(res, await beadLibraryService.getByClientId(id));
}

async function create(req: Request, res: Response): Promise<void> {
  const payload = validateBody(createBeadLibraryDto, req.body);
  sendCreated(res, await beadLibraryService.create(payload));
}

async function update(req: Request, res: Response): Promise<void> {
  const { id } = beadLibraryIdParam.parse(req.params);
  const payload = validateBody(updateBeadLibraryDto, req.body);
  sendJson(res, await beadLibraryService.update(id, payload));
}

async function updateCrop(req: Request, res: Response): Promise<void> {
  const { id } = beadLibraryIdParam.parse(req.params);
  const payload = validateBody(beadLibraryCropDto, req.body);
  sendJson(res, await beadLibraryService.updateCrop(id, payload));
}

async function saveComplete(req: Request, res: Response): Promise<void> {
  const { id } = beadLibraryIdParam.parse(req.params);
  const payload = validateBody(beadLibraryCompleteSaveSchema, req.body);
  sendJson(res, await beadLibraryService.saveComplete(id, payload));
}

async function remove(req: Request, res: Response): Promise<void> {
  const { id } = beadLibraryIdParam.parse(req.params);
  sendJson(res, await beadLibraryService.remove(id));
}

async function recalculateBoundsMetadata(_req: Request, res: Response): Promise<void> {
  sendJson(res, await beadLibraryService.recalculateBoundsMetadata());
}

export const beadLibraryHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  saveComplete: asyncHandler(saveComplete),
  updateCrop: asyncHandler(updateCrop),
  remove: asyncHandler(remove),
  recalculateBoundsMetadata: asyncHandler(recalculateBoundsMetadata),
};
