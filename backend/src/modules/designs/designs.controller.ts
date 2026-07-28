import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendData, sendDataCreated, sendNoContent } from "../../lib/http-response.js";
import { getAuthUserId } from "../../middleware/auth-mutations.js";
import { designsService } from "./designs.service.js";
import { bulkDeleteDesignsDto, designIdParam, saveDesignDto } from "./designs.validation.js";

async function listDesigns(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  sendData(req, res, await designsService.listForUser(userId));
}

async function getDesign(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const { id } = designIdParam.parse(req.params);
  sendData(req, res, await designsService.getDesignDetail(userId, id));
}

async function saveDesign(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const body = saveDesignDto.parse(req.body);
  const isUpdate = Boolean(body.designId);
  const result = await designsService.saveDesign(userId, body);
  if (isUpdate) {
    sendData(req, res, result);
  } else {
    sendDataCreated(req, res, result);
  }
}

async function deleteDesign(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const { id } = designIdParam.parse(req.params);
  await designsService.deleteDesign(userId, id);
  sendNoContent(res);
}

async function bulkDeleteDesigns(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const body = bulkDeleteDesignsDto.parse(req.body);
  sendData(req, res, await designsService.bulkDeleteDesigns(userId, body.designIds));
}

async function duplicateDesign(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const { id } = designIdParam.parse(req.params);
  sendDataCreated(req, res, await designsService.duplicateDesign(userId, id));
}

export const designsHandlers = {
  listDesigns: asyncHandler(listDesigns),
  getDesign: asyncHandler(getDesign),
  saveDesign: asyncHandler(saveDesign),
  duplicateDesign: asyncHandler(duplicateDesign),
  deleteDesign: asyncHandler(deleteDesign),
  bulkDeleteDesigns: asyncHandler(bulkDeleteDesigns),
};
