import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../client";
import { createApiKey, listApiKeys, revokeApiKey } from "../apiKeys";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiKeys API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("lists API keys through the shared client and validates the bare array", async () => {
    const keys = [
      {
        id: "key-1",
        name: "CI deploy",
        prefix: "abcd1234",
        last_used_at: null,
        created_at: "2026-06-15T12:00:00Z",
      },
    ];
    fetchMock.mockResolvedValue(jsonResponse(200, keys));

    await expect(listApiKeys()).resolves.toEqual(keys);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/keys");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("rejects a list response that is not the documented shape", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }));

    await expect(listApiKeys()).rejects.toMatchObject({ name: "ApiValidationError" });
  });

  it("creates an API key with a name-only body", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, {
        id: "key-2",
        name: "Local dev",
        prefix: "efgh5678",
        key: "rk_live_secret",
      }),
    );

    const result = await createApiKey("Local dev");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/keys");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Local dev" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(result).toEqual({
      id: "key-2",
      name: "Local dev",
      prefix: "efgh5678",
      key: "rk_live_secret",
    });
  });

  it("revokes an API key by id", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await revokeApiKey("key-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/keys/key-1");
    expect(init.method).toBe("DELETE");
  });

  it("throws ApiError with the server message on failure", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { error: "Maximum of 20 active API keys reached" }),
    );

    const error = await createApiKey("Another").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "Maximum of 20 active API keys reached",
    });
  });

  it("surfaces 401 from the list endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Not authenticated" }));

    await expect(listApiKeys()).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Not authenticated",
    });
  });

  it("accepts a list where never-used keys omit last_used_at", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, [
        { id: "key-1", name: "CI deploy", prefix: "abcd1234", created_at: "2026-06-15T12:00:00Z" },
      ]),
    );

    const [key] = await listApiKeys();

    expect(key.last_used_at).toBeNull();
  });

  it("rejects a create response that is missing the one-time key", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { id: "key-2", name: "Local dev", prefix: "efgh5678" }),
    );

    await expect(createApiKey("Local dev")).rejects.toMatchObject({
      name: "ApiValidationError",
    });
  });

  it("surfaces 404 from revoke", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "API key not found" }));

    await expect(revokeApiKey("missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "API key not found",
    });
  });
});
