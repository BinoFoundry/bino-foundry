import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendJson } from "../../lib/http-response.js";
import { beadAvailabilityStatusService } from "./bead-availability-status.service.js";

async function list(_req: Request, res: Response): Promise<void> {
  sendJson(res, await beadAvailabilityStatusService.list());
}

export const beadAvailabilityStatusHandlers = {
  list: asyncHandler(list),
};
