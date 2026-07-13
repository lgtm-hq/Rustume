import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiKey, listApiKeys, revokeApiKey } from "../apiKeys";

describe("apiKeys API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("lists API keys", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "key-1",
          name: "CI deploy",
          prefix: "abcd1234",
          last_used_at: null,
          created_at: "2026-06-15T12:00:00Z",
        },
      ],
    });

    await expect(listApiKeys()).resolves.toEqual([
      {
        id: "key-1",
        name: "CI deploy",
        prefix: "abcd1234",
        last_used_at: null,
        created_at: "2026-06-15T12:00:00Z",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/keys", { credentials: "include" });
  });

  it("creates an API key with a name", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "key-2",
        name: "Local dev",
        prefix: "efgh5678",
        key: "rk_live_secret",
      }),
    });

    const result = await createApiKey("Local dev");

    expect(fetchMock).toHaveBeenCalledWith("/api/keys", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Local dev" }),
    });
    expect(result.key).toBe("rk_live_secret");
  });

  it("revokes an API key by id", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await revokeApiKey("key-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/keys/key-1", {
      method: "DELETE",
      credentials: "include",
    });
  });

  it("throws ApiError with server message on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      text: async () => JSON.stringify({ error: "Maximum of 20 active API keys reached" }),
    });

    await expect(createApiKey("Another")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "Maximum of 20 active API keys reached",
    });
  });
});
