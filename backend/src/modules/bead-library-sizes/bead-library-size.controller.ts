import type { Request, Response } from "express";

import { sendJson } from "../../lib/http-response.js";
import { validateBody } from "../../lib/validation.js";
import { beadLibrarySizeService } from "./bead-library-size.service.js";
import { beadLibraryIdParam, syncLibrarySizesDto } from "./bead-library-size.validation.js";

async function list(req: Request, res: Response) {
  const libraryId = typeof req.query.libraryId === "string" ? req.query.libraryId : undefined;
  sendJson(res, await beadLibrarySizeService.list({ libraryId }));
}

async function sync(req: Request, res: Response) {
  const { id } = beadLibraryIdParam.parse(req.params);
  const payload = validateBody(syncLibrarySizesDto, req.body);
  sendJson(res, await beadLibrarySizeService.syncLibrarySizes(id, payload));
}

export const beadLibrarySizeHandlers = {
  list,
  sync,
};
