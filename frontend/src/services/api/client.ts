import { getAdminApiKey, resolveApiUrl } from "@/config/env";
import {
  clearSessionAfterAuthFailure,
  ensureFreshAccessToken,
  forceRefreshAccessToken,
} from "@/services/auth/access-token";
import { getAccessToken } from "@/services/auth/session";

import { ApiError } from "./errors";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  /** Skip JSON serialization for `body` (e.g. FormData). */
  rawBody?: boolean;
  /** Internal: request already retried after a token refresh. */
  _authRetried?: boolean;
};

/** Auth routes that must not trigger access-token refresh or 401 retry loops. */
function isAuthBootstrapPath(path: string): boolean {
  return (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/forgot-password") ||
    path.startsWith("/auth/reset-password") ||
    path.startsWith("/auth/resend-verification") ||
    path.startsWith("/auth/confirm-email") ||
    path.startsWith("/auth/logout")
  );
}

function buildHeaders(init: ApiRequestOptions | undefined, accessToken: string | null): Headers {
  const headers = new Headers(init?.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const adminKey = getAdminApiKey();
  if (adminKey && !headers.has("x-api-key")) {
    headers.set("x-api-key", adminKey);
  }

  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const body = init?.body;
  const isJsonPayload =
    body !== null &&
    body !== undefined &&
    !init?.rawBody &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    (typeof body === "object" || typeof body === "string");

  if (isJsonPayload && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function resolveBody(init?: ApiRequestOptions): BodyInit | undefined {
  if (init?.body === null || init?.body === undefined) return undefined;
  if (init.rawBody && typeof init.body !== "object") {
    return init.body as BodyInit;
  }
  if (
    init.body instanceof FormData ||
    init.body instanceof Blob ||
    init.body instanceof ArrayBuffer ||
    typeof init.body === "string"
  ) {
    return init.body;
  }
  return JSON.stringify(init.body);
}

async function parseErrorPayload(res: Response): Promise<{ message: string; code?: string; details?: unknown }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return {
        message: "Unable to reach the server. Please try again.",
        code: "GATEWAY_ERROR",
      };
    }
    return { message: res.statusText || `HTTP ${res.status}` };
  }

  try {
    const json = (await res.json()) as {
      message?: string;
      error?: { message?: string; code?: string; details?: unknown };
    };
    const message = json.error?.message ?? json.message ?? res.statusText;
    return { message, code: json.error?.code, details: json.error?.details };
  } catch {
    return { message: res.statusText || `HTTP ${res.status}` };
  }
}

function mapAuthErrorMessage(status: number, code: string | undefined, message: string): string {
  if (status === 401) {
    if (code === "SESSION_EXPIRED") {
      return "Your session has expired. Please sign in again.";
    }
    return message || "Authentication required";
  }
  if (status === 403) {
    return message || "You do not have permission to perform this action.";
  }
  return message;
}

/** Default catalogue request budget — prevents infinite “Loading catalogue…” on gateway hangs. */
const DEFAULT_API_TIMEOUT_MS = 25_000;

/** Low-level catalogue HTTP call; path is relative to `/api` prefix. */
export async function apiRequest<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const url = resolveApiUrl(path);
  const { body: _body, rawBody: _raw, _authRetried, signal: userSignal, ...rest } = init ?? {};
  const bootstrap = isAuthBootstrapPath(path);

  const accessToken = bootstrap ? getAccessToken() : await ensureFreshAccessToken();

  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), DEFAULT_API_TIMEOUT_MS);
  const onUserAbort = () => timeoutController.abort();
  if (userSignal) {
    if (userSignal.aborted) timeoutController.abort();
    else userSignal.addEventListener("abort", onUserAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      signal: timeoutController.signal,
      headers: buildHeaders(init, accessToken),
      body: resolveBody(init),
    });
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    if (aborted && userSignal?.aborted) {
      throw new ApiError(499, "Request cancelled.", { code: "ABORTED" });
    }
    if (aborted) {
      throw new ApiError(504, "Unable to reach the server. Please try again.", {
        code: "TIMEOUT",
      });
    }
    throw new ApiError(503, "Unable to reach the server. Please try again.", { code: "NETWORK_ERROR" });
  } finally {
    window.clearTimeout(timeoutId);
    userSignal?.removeEventListener("abort", onUserAbort);
  }

  if (res.status === 401 && !bootstrap && !_authRetried) {
    const renewed = await forceRefreshAccessToken();
    if (renewed) {
      return apiRequest<T>(path, { ...init, _authRetried: true });
    }
    clearSessionAfterAuthFailure();
  }

  if (!res.ok) {
    const err = await parseErrorPayload(res);
    const message = mapAuthErrorMessage(res.status, err.code, err.message);
    throw new ApiError(res.status, message, { code: err.code, details: err.details });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Unwrap `{ data, meta }` envelope from auth/design endpoints. */
export async function apiRequestData<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const payload = await apiRequest<{ data: T; meta?: unknown }>(path, init);
  return payload.data;
}

/** @deprecated Prefer `apiRequest` — kept for gradual migration. */
export function cataloguePath(pathSegment: string): string {
  const p = pathSegment.startsWith("/") ? pathSegment : `/${pathSegment}`;
  return resolveApiUrl(p);
}

/** @deprecated Prefer `apiRequest` */
export async function catalogueFetch(resourcePath: string, init?: RequestInit): Promise<Response> {
  const url = resolveApiUrl(resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`);
  await ensureFreshAccessToken();
  const headers = new Headers(init?.headers);
  const adminKey = getAdminApiKey();
  if (adminKey && !headers.has("x-api-key")) headers.set("x-api-key", adminKey);
  const accessToken = getAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(url, { ...init, headers });
}
