export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(message = "Image file is too large") {
    super(413, "PAYLOAD_TOO_LARGE", message);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaError extends HttpError {
  constructor(message = "Unsupported image format") {
    super(415, "UNSUPPORTED_MEDIA", message);
    this.name = "UnsupportedMediaError";
  }
}

export class ProcessingError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(422, "PROCESSING_ERROR", message, details);
    this.name = "ProcessingError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
    this.name = "ConflictError";
  }
}

export function wrapUnknownError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof Error) {
    const http = error as Error & { statusCode?: number; code?: string };
    if (typeof http.statusCode === "number" && http.code) {
      return new HttpError(http.statusCode, http.code, error.message);
    }
    return new HttpError(500, "INTERNAL_ERROR", error.message);
  }
  return new HttpError(500, "INTERNAL_ERROR", "Unexpected server error");
}
