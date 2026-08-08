import { formatApiErrorMessage, isApiError } from "@/services/api/errors";

import { BRACELET_COPY } from "@/features/bracelet/copy";
import { CUSTOMER_COPY } from "@/lib/customer-copy";

/**
 * Map design-save API failures to customer-facing copy.
 * Prefer the server message when it is already actionable.
 */
export function formatDesignSaveError(error: unknown): string {
  if (!isApiError(error)) {
    return error instanceof Error && error.message.trim()
      ? error.message
      : CUSTOMER_COPY.saveDesignFailed;
  }

  if (error.status === 401) {
    return CUSTOMER_COPY.saveDesignSessionExpired;
  }

  const raw = formatApiErrorMessage(error).trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("unavailable") ||
    lower.includes("no longer available") ||
    lower.includes("not enabled for bead") ||
    lower.includes("size not enabled")
  ) {
    return BRACELET_COPY.saveBlockedUnavailable;
  }

  if (lower.includes("at least one bead") || lower.includes("bead must be placed")) {
    return CUSTOMER_COPY.saveDesignNeedBeads;
  }

  if (lower.includes("session") && lower.includes("expired")) {
    return CUSTOMER_COPY.saveDesignSessionExpired;
  }

  if (lower.includes("sign in") || lower.includes("authentication")) {
    return CUSTOMER_COPY.saveDesignSessionExpired;
  }

  // Prefer specific validation / conflict messages from the API.
  if (error.status >= 400 && error.status < 500 && raw && raw !== "Request validation failed") {
    return raw;
  }

  if (lower.includes("request validation failed")) {
    return CUSTOMER_COPY.saveDesignInvalidPayload;
  }

  return CUSTOMER_COPY.saveDesignFailed;
}
