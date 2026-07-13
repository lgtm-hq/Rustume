import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { probeAuth, userDisplayName } from "../auth";

describe("userDisplayName", () => {
  it("returns the username when present", () => {
    expect(
      userDisplayName({
        username: "swift-otter-4821",
      }),
    ).toBe("swift-otter-4821");
  });

  it("returns a generic label when username is empty", () => {
    expect(userDisplayName({ username: "" })).toBe("Account");
  });
});

describe("probeAuth", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("maps username from /auth/me", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "free",
        email: "dev@example.com",
        username: "swift-otter-4821",
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: {
        id: "user-1",
        plan: "free",
        email: "dev@example.com",
        username: "swift-otter-4821",
      },
      requireAuth: false,
    });
  });

  it("maps subscription info from /auth/me", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "pro",
        username: "calm-finch-1234",
        subscription: {
          status: "canceled",
          expires_at: "2026-07-15T00:00:00Z",
        },
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: {
        id: "user-1",
        plan: "pro",
        username: "calm-finch-1234",
        subscription: {
          status: "canceled",
          expires_at: "2026-07-15T00:00:00Z",
        },
      },
      requireAuth: false,
    });
  });

  it("maps expired subscription without expires_at", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "pro",
        username: "bold-wolf-9001",
        subscription: { status: "canceled" },
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: {
        id: "user-1",
        plan: "pro",
        username: "bold-wolf-9001",
        subscription: { status: "canceled" },
      },
      requireAuth: false,
    });
  });

  it("omits subscription when field is absent", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "free",
        username: "minty-lynx-5555",
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: { id: "user-1", plan: "free", username: "minty-lynx-5555" },
      requireAuth: false,
    });
  });

  it("ignores malformed subscription payloads", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "pro",
        username: "minty-lynx-5555",
        subscription: { status: 42, expires_at: "2026-07-15T00:00:00Z" },
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: { id: "user-1", plan: "pro", username: "minty-lynx-5555" },
      requireAuth: false,
    });
  });

  it("maps require_auth from authenticated /auth/me", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "free",
        username: "minty-lynx-5555",
        require_auth: true,
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: { id: "user-1", plan: "free", username: "minty-lynx-5555" },
      requireAuth: true,
    });
  });

  it("returns self-hosted mode when cloud auth is disabled", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(probeAuth()).resolves.toEqual({ mode: "self-hosted" });
  });

  it("returns signed-out cloud mode on 401", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Not authenticated", require_auth: true }),
    });

    await expect(probeAuth()).resolves.toEqual({
      mode: "cloud",
      user: null,
      requireAuth: true,
    });
  });

  it("rejects invalid authenticated /auth/me payloads", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    });

    await expect(probeAuth()).rejects.toThrow(/invalid \/auth\/me response/i);
  });
});
