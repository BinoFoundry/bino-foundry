export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Include Zod field errors from validation responses when present. */
export function formatApiErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : "Request failed";
  }

  const details = error.details as
    | { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
    | undefined;

  const lines = [error.message];
  if (details?.formErrors?.length) {
    lines.push(...details.formErrors);
  }
  if (details?.fieldErrors) {
    for (const [field, messages] of Object.entries(details.fieldErrors)) {
      if (messages?.length) lines.push(`${field}: ${messages.join(", ")}`);
    }
  }
  return lines.join("\n");
}
