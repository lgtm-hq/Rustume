import { del, get, post } from "./client";
import { apiKeyListSchema, createdApiKeySchema } from "./schemas";

/** Active API key as returned by `GET /api/keys` (a bare JSON array). */
export interface ApiKeySummary {
  id: string;
  name: string;
  /** First eight characters after the `rk_` prefix; the prefix itself is not included. */
  prefix: string;
  last_used_at: string | null;
  created_at: string;
}

/** `POST /api/keys` response. The plaintext `key` is only ever returned here. */
export interface CreatedApiKey {
  id: string;
  name: string;
  prefix: string;
  key: string;
}

/** Maximum key name length accepted by the server. */
export const API_KEY_NAME_MAX_LENGTH = 100;

/** List active API keys for the signed-in user. */
export async function listApiKeys(): Promise<ApiKeySummary[]> {
  return get("/keys", apiKeyListSchema);
}

/** Create a new API key. The plaintext key is returned exactly once. */
export async function createApiKey(name: string): Promise<CreatedApiKey> {
  return post("/keys", { name }, createdApiKeySchema);
}

/** Revoke an API key by id. */
export async function revokeApiKey(id: string): Promise<void> {
  await del(`/keys/${encodeURIComponent(id)}`);
}
