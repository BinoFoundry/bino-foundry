import { getAdminApiKey, resolveApiUrl } from "@/config/env";

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

  const body = init?.body;
  const isJsonObject =
    body !== null &&
    body !== undefined &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !init?.rawBody;

  if (isJsonObject && !headers.has("Content-Type")) {
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

  const res = await fetch(url, {
    ...rest,
    headers: buildHeaders(init),
    body: resolveBody(init),
  });

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
