import type { Request, Response } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { beadTypeService } from "../bead-types/bead-type.service.js";
import { strandRenderMigrationService } from "./strand-render-migration.service.js";

const libraryIdsDto = z.object({
  libraryIds: z.array(z.string().uuid()).optional(),
});

const typeIdParam = z.object({
  typeId: z.string().uuid(),
});

async function initializeMissing(_req: Request, res: Response): Promise<void> {
  sendJson(res, await strandRenderMigrationService.initializeMissingTypeDefaults());
}

async function runFullMigration(_req: Request, res: Response): Promise<void> {
  sendJson(res, await strandRenderMigrationService.runStartupMigration());
}

async function cleanupLibraries(_req: Request, res: Response): Promise<void> {
  sendJson(res, await strandRenderMigrationService.cleanupRedundantLibraryOverrides());
}

async function resetLibrariesToType(req: Request, res: Response): Promise<void> {
  const { libraryIds } = validateBody(libraryIdsDto, req.body ?? {});
  sendJson(res, await strandRenderMigrationService.resetLibrariesToTypeDefaults(libraryIds));
}

async function resetTypeToSystem(req: Request, res: Response): Promise<void> {
  const { typeId } = typeIdParam.parse(req.params);
  await strandRenderMigrationService.resetTypeToSystemDefaults(typeId);
  sendJson(res, await beadTypeService.get(typeId));
}

async function applyTypeToLibraries(req: Request, res: Response): Promise<void> {
  const { typeId } = typeIdParam.parse(req.params);
  sendJson(res, await strandRenderMigrationService.applyTypeDefaultsToLibraries(typeId));
}

export const strandRenderMigrationHandlers = {
  initializeMissing: asyncHandler(initializeMissing),
  runFullMigration: asyncHandler(runFullMigration),
  cleanupLibraries: asyncHandler(cleanupLibraries),
  resetLibrariesToType: asyncHandler(resetLibrariesToType),
  resetTypeToSystem: asyncHandler(resetTypeToSystem),
  applyTypeToLibraries: asyncHandler(applyTypeToLibraries),
};
