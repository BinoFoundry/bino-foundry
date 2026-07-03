import { getAdminApiKey, resolveApiUrl } from "@/config/env";
import { getAccessToken } from "@/services/auth/session";

import { ApiError } from "./errors";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  /** Skip JSON serialization for `body` (e.g. FormData). */
  rawBody?: boolean;
};

function buildHeaders(init?: ApiRequestOptions): Headers {
  const headers = new Headers(init?.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const adminKey = getAdminApiKey();
  if (adminKey && !headers.has("x-api-key")) {
    headers.set("x-api-key", adminKey);
  }

  const accessToken = getAccessToken();
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
        message: "Unable to upload image. The server is temporarily unavailable — please try again.",
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

/** Low-level catalogue HTTP call; path is relative to `/api` prefix. */
export async function apiRequest<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const url = resolveApiUrl(path);
  const { body: _body, rawBody: _raw, ...rest } = init ?? {};

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: buildHeaders(init),
      body: resolveBody(init),
    });
  } catch {
    throw new ApiError(503, "Unable to reach the server. Please try again.", { code: "NETWORK_ERROR" });
  }

  if (!res.ok) {
    const err = await parseErrorPayload(res);
    throw new ApiError(res.status, err.message, { code: err.code, details: err.details });
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
  const headers = new Headers(init?.headers);
  const adminKey = getAdminApiKey();
  if (adminKey && !headers.has("x-api-key")) headers.set("x-api-key", adminKey);
  return fetch(url, { ...init, headers });
}
