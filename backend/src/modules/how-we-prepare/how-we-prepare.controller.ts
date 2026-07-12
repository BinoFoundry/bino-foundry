import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { howWePrepareService } from "./how-we-prepare.service.js";
import {
  createHowWePrepareOptionDto,
  howWePrepareOptionIdParam,
  updateHowWePrepareOptionDto,
  type HowWePrepareOptionCreateDTO,
  type HowWePrepareOptionUpdateDTO,
} from "./how-we-prepare.validation.js";

async function list(req: Request, res: Response) {
  const activeOnly = req.query.active === "1" || req.query.active === "true";
  sendJson(res, await howWePrepareService.list(activeOnly));
}

async function retrieve(req: Request, res: Response) {
  const { id } = howWePrepareOptionIdParam.parse(req.params);
  sendJson(res, await howWePrepareService.get(id));
}

async function create(req: Request, res: Response) {
  const payload = validateBody(createHowWePrepareOptionDto, req.body) as HowWePrepareOptionCreateDTO;
  sendCreated(res, await howWePrepareService.create(payload));
}

async function update(req: Request, res: Response) {
  const { id } = howWePrepareOptionIdParam.parse(req.params);
  const payload = validateBody(updateHowWePrepareOptionDto, req.body) as HowWePrepareOptionUpdateDTO;
  sendJson(res, await howWePrepareService.update(id, payload));
}

async function remove(req: Request, res: Response) {
  const { id } = howWePrepareOptionIdParam.parse(req.params);
  sendJson(res, await howWePrepareService.remove(id));
}

export const howWePrepareHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
