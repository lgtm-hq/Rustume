import type { z } from "zod";
import { del, get, post } from "./client";
import { apiKeyListSchema, apiKeySummarySchema, createdApiKeySchema } from "./schemas";

/**
 * Active API key as returned by `GET /api/keys` (a bare JSON array).
 *
 * `prefix` is the first eight characters after the `rk_` scheme; the scheme
 * itself is not included. Inferred from the zod schema so the compile-time and
 * runtime contracts cannot drift.
 */
export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>;

/** `POST /api/keys` response. The plaintext `key` is only ever returned here. */
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;

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
