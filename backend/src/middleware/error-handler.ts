import type { ErrorRequestHandler } from "express";

import { HttpError, wrapUnknownError } from "../lib/errors.js";

type Logger = Pick<Console, "error">;

export function createErrorHandler(logger: Logger = console): ErrorRequestHandler {
  return (error: unknown, req, res, _next): void => {
    if (res.headersSent) {
      return;
    }

    const httpErr = wrapUnknownError(error);
    let statusCode = httpErr.statusCode ?? 500;

    const maybeLegacy = error as Error & { status?: number };
    if (!(error instanceof HttpError) && typeof maybeLegacy.status === "number") {
      statusCode = maybeLegacy.status;
    }

    const payload = {
      success: false,
      error: {
        code: httpErr.code ?? "INTERNAL_ERROR",
        message: httpErr.message,
        details: httpErr.details ?? null,
      },
      requestId: req.requestId,
      message: httpErr.message,
    };

    if (statusCode >= 500) {
      logger.error(`[${req.method} ${req.path}] request=${req.requestId}`, error);
    }

    res.status(statusCode).json(payload);
  };
}
