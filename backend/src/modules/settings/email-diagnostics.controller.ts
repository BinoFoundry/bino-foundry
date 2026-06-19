import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendJson } from "../../lib/http-response.js";
import { emailDiagnosticsService } from "./email-diagnostics.service.js";

async function getEmailDiagnostics(_req: Request, res: Response): Promise<void> {
  sendJson(res, await emailDiagnosticsService.getDiagnostics());
}

export const emailDiagnosticsHandlers = {
  getEmailDiagnostics: asyncHandler(getEmailDiagnostics),
};
