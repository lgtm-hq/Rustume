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

function isPreviewEndpoint(endpoint: string): boolean {
  return endpoint.includes("/render/preview");
}

async function maybeShowRateLimitToast(endpoint: string, method: string): Promise<void> {
  const willShow = isPreviewEndpoint(endpoint) || isSaveMethod(method);
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

  toast.warning("Saving paused briefly — too many rapid changes");
}

async function request<T>(endpoint: string, options: RequestInit = {}, attempt = 0): Promise<T> {
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

    if (isSaveMethod(method) && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(retryAfterMs);
      return request<T>(endpoint, options, attempt + 1);
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
    return response.json();
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

export async function get<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: "GET" });
}

export async function post<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "POST",
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });
}

export async function put<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "PUT",
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });
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
  attempt = 0,
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
      return fetchBlobWithHeaders(endpoint, body, attempt + 1);
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
