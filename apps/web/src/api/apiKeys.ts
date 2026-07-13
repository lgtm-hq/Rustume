import { ApiError } from "./client";

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export interface CreatedApiKey extends ApiKeySummary {
  key: string;
}

async function throwApiError(response: Response): Promise<never> {
  const text = await response.text();
  let message = text;
  try {
    const json = JSON.parse(text) as { error?: string };
    if (typeof json.error === "string") {
      message = json.error;
    }
  } catch {
    // Keep raw text when the body is not JSON.
  }
  throw new ApiError(response.status, message || response.statusText);
}

/** List active API keys for the signed-in user. */
export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const response = await fetch("/api/keys", { credentials: "include" });
  if (!response.ok) {
    throw await throwApiError(response);
  }
  return (await response.json()) as ApiKeySummary[];
}

/** Create a new API key. The plaintext key is returned exactly once. */
export async function createApiKey(name: string): Promise<CreatedApiKey> {
  const response = await fetch("/api/keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw await throwApiError(response);
  }
  return (await response.json()) as CreatedApiKey;
}

/** Revoke an API key by id. */
export async function revokeApiKey(id: string): Promise<void> {
  const response = await fetch(`/api/keys/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw await throwApiError(response);
  }
}
