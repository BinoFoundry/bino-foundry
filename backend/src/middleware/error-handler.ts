import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";

import { HttpError, PayloadTooLargeError, UnsupportedMediaError, wrapUnknownError } from "../lib/errors.js";

type Logger = Pick<Console, "error">;

export function createErrorHandler(logger: Logger = console): ErrorRequestHandler {
  return (error: unknown, req, res, _next): void => {
    if (res.headersSent) {
      return;
    }

    let httpErr = wrapUnknownError(error);
    let statusCode = httpErr.statusCode ?? 500;

    if (error instanceof MulterError) {
      httpErr =
        error.code === "LIMIT_FILE_SIZE"
          ? new PayloadTooLargeError(
              `Image file is too large (max ${Math.round((50 * 1024 * 1024) / (1024 * 1024))} MB)`,
            )
          : new UnsupportedMediaError(error.message);
      statusCode = httpErr.statusCode;
    }

    const maybeLegacy = error as Error & { status?: number };
    if (!(error instanceof HttpError) && !(error instanceof MulterError) && typeof maybeLegacy.status === "number") {
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
      logger.error(`[${req.method} ${req.path}] request=${req.requestId}`, {
        message: httpErr.message,
        code: httpErr.code,
        stack: error instanceof Error ? error.stack : undefined,
        details: httpErr.details ?? null,
      });
    }

    res.status(statusCode).json(payload);
  };
}
