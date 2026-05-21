import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { sunglassesCatalogService } from "./sunglasses.service.js";
import {
  builderOptionCreateDto,
  builderOptionIdParam,
  builderOptionUpdateDto,
  lensTintCreateDto,
  lensTintIdParam,
  lensTintUpdateDto,
} from "./sunglasses.validation.js";

async function getCatalog(_req: Request, res: Response): Promise<void> {
  sendJson(res, await sunglassesCatalogService.getCatalog());
}

async function getAdminCatalog(_req: Request, res: Response): Promise<void> {
  sendJson(res, await sunglassesCatalogService.getAdminCatalog());
}

async function listLensTints(_req: Request, res: Response): Promise<void> {
  sendJson(res, await sunglassesCatalogService.listLensTints(true));
}

async function createLensTint(req: Request, res: Response): Promise<void> {
  const dto = validateBody(lensTintCreateDto, req.body);
  sendCreated(res, await sunglassesCatalogService.createLensTint(dto));
}

async function updateLensTint(req: Request, res: Response): Promise<void> {
  const { id } = lensTintIdParam.parse(req.params);
  const dto = validateBody(lensTintUpdateDto, req.body);
  sendJson(res, await sunglassesCatalogService.updateLensTint(id, dto));
}

async function removeLensTint(req: Request, res: Response): Promise<void> {
  const { id } = lensTintIdParam.parse(req.params);
  sendJson(res, await sunglassesCatalogService.removeLensTint(id));
}

async function listBuilderOptions(_req: Request, res: Response): Promise<void> {
  sendJson(res, await sunglassesCatalogService.listBuilderOptions(true));
}

async function createBuilderOption(req: Request, res: Response): Promise<void> {
  const dto = validateBody(builderOptionCreateDto, req.body);
  sendCreated(res, await sunglassesCatalogService.createBuilderOption(dto));
}

async function updateBuilderOption(req: Request, res: Response): Promise<void> {
  const { id } = builderOptionIdParam.parse(req.params);
  const dto = validateBody(builderOptionUpdateDto, req.body);
  sendJson(res, await sunglassesCatalogService.updateBuilderOption(id, dto));
}

async function removeBuilderOption(req: Request, res: Response): Promise<void> {
  const { id } = builderOptionIdParam.parse(req.params);
  sendJson(res, await sunglassesCatalogService.removeBuilderOption(id));
}

export const sunglassesHandlers = {
  getCatalog: asyncHandler(getCatalog),
  getAdminCatalog: asyncHandler(getAdminCatalog),
  listLensTints: asyncHandler(listLensTints),
  createLensTint: asyncHandler(createLensTint),
  updateLensTint: asyncHandler(updateLensTint),
  removeLensTint: asyncHandler(removeLensTint),
  listBuilderOptions: asyncHandler(listBuilderOptions),
  createBuilderOption: asyncHandler(createBuilderOption),
  updateBuilderOption: asyncHandler(updateBuilderOption),
  removeBuilderOption: asyncHandler(removeBuilderOption),
};
