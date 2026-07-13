import type { z } from "zod";

const API_BASE = "/api";

const defaultFetchOptions: RequestInit = {
  credentials: "include",
};

const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_TOAST_COOLDOWN_MS = 5000;

let lastRateLimitToastAt = 0;

export interface RateLimitErrorBody {
  error: string;
  retry_after?: number;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(response: Response, bodyText: string): number {
  const header = response.headers.get("Retry-After");
  if (header) {
    const parsed = Number.parseInt(header, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  try {
    const body = JSON.parse(bodyText) as RateLimitErrorBody;
    if (typeof body.retry_after === "number" && body.retry_after > 0) {
      return body.retry_after;
    }
  } catch {
    // Ignore malformed JSON bodies.
  }

  return 1;
}

function isSaveMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH"].includes(method.toUpperCase());
}

function shouldNotifyRateLimit(method: string): boolean {
  return isSaveMethod(method) || method.toUpperCase() === "DELETE";
}

function isPreviewEndpoint(endpoint: string): boolean {
  return endpoint.includes("/render/preview");
}

function isPdfEndpoint(endpoint: string): boolean {
  return endpoint.includes("/render/pdf");
}

function shouldRetryOnRateLimit(_endpoint: string, method: string): boolean {
  return isSaveMethod(method);
}

async function maybeShowRateLimitToast(endpoint: string, method: string): Promise<void> {
  const willShow =
    isPreviewEndpoint(endpoint) || isPdfEndpoint(endpoint) || shouldNotifyRateLimit(method);
  if (!willShow) {
    return;
  }

  const now = Date.now();
  if (now - lastRateLimitToastAt < RATE_LIMIT_TOAST_COOLDOWN_MS) {
    return;
  }
  lastRateLimitToastAt = now;

  const { toast } = await import("../components/ui");
  if (isPreviewEndpoint(endpoint)) {
    toast.warning("Preview paused briefly — too many rapid updates");
    return;
  }

  if (isPdfEndpoint(endpoint)) {
    toast.warning("PDF export paused briefly — too many rapid requests");
    return;
  }

  toast.warning("Saving paused briefly — too many rapid changes");
}

function formatValidationError(endpoint: string, error: z.ZodError): string {
  return `API response validation failed for ${endpoint}: ${error.message}`;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  attempt = 0,
  schema?: z.ZodType<T>,
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Only set Content-Type for methods that send a body
  const headers: HeadersInit = { ...options.headers };
  const method = options.method?.toUpperCase() || "GET";
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody || ["POST", "PUT", "PATCH"].includes(method)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...defaultFetchOptions,
    ...options,
    headers,
  });

  if (response.status === 429) {
    const text = await response.text();
    const retryAfterMs = parseRetryAfterSeconds(response, text) * 1000;

    if (shouldRetryOnRateLimit(endpoint, method) && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(retryAfterMs);
      return request<T>(endpoint, options, attempt + 1, schema);
    }

    await maybeShowRateLimitToast(endpoint, method);
    throw new ApiError(response.status, text || response.statusText);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  // Check if response is JSON
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const json: unknown = await response.json();
    if (schema) {
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new ApiValidationError(
          endpoint,
          formatValidationError(endpoint, parsed.error),
          parsed.error,
        );
      }
      return parsed.data;
    }
    return json as T;
  }

  // Return text body for non-JSON responses
  return (await response.text()) as unknown as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiValidationError extends Error {
  constructor(
    public endpoint: string,
    message: string,
    public zodError?: z.ZodError,
  ) {
    super(message);
    this.name = "ApiValidationError";
  }
}

export async function get<T>(endpoint: string, schema?: z.ZodType<T>): Promise<T> {
  return request<T>(endpoint, { method: "GET" }, 0, schema);
}

export async function post<T>(endpoint: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: "POST",
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    },
    0,
    schema,
  );
}

export async function put<T>(endpoint: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: "PUT",
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    },
    0,
    schema,
  );
}

export async function delJson<T>(
  endpoint: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: "DELETE",
      body: JSON.stringify(body),
    },
    0,
    schema,
  );
}

export async function del(endpoint: string): Promise<void> {
  await request<void>(endpoint, { method: "DELETE" });
}

export async function fetchBlob(endpoint: string, body?: unknown): Promise<Blob> {
  const { blob } = await fetchBlobWithHeaders(endpoint, body);
  return blob;
}

export interface BlobResponse {
  blob: Blob;
  headers: Headers;
}

export async function fetchBlobWithHeaders(
  endpoint: string,
  body?: unknown,
): Promise<BlobResponse> {
  return fetchBlobWithHeadersInternal(endpoint, body, 0);
}

async function fetchBlobWithHeadersInternal(
  endpoint: string,
  body: unknown | undefined,
  attempt: number,
): Promise<BlobResponse> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...defaultFetchOptions,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });

  if (response.status === 429) {
    const text = await response.text();
    const retryAfterMs = parseRetryAfterSeconds(response, text) * 1000;

    if (attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(retryAfterMs);
      return fetchBlobWithHeadersInternal(endpoint, body, attempt + 1);
    }

    await maybeShowRateLimitToast(endpoint, "POST");
    throw new ApiError(response.status, text || response.statusText);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  return { blob: await response.blob(), headers: response.headers };
}
