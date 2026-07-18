import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { probeAuth, userDisplayName } from "../auth";

describe("userDisplayName", () => {
  it("prefers first and last name when both are present", () => {
    expect(
      userDisplayName({
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
      }),
    ).toBe("Ada Lovelace");
  });

  it("falls back to email when names are missing", () => {
    expect(userDisplayName({ email: "dev@example.com" })).toBe("dev@example.com");
  });

  it("returns a generic label when profile fields are empty", () => {
    expect(userDisplayName({})).toBe("Account");
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

  it("maps extended profile fields from /auth/me", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "free",
        email: "dev@example.com",
        first_name: "Grace",
        last_name: "Hopper",
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: {
        id: "user-1",
        plan: "free",
        email: "dev@example.com",
        first_name: "Grace",
        last_name: "Hopper",
      },
      requireAuth: false,
      billingEnabled: false,
    });
  });

  it("maps subscription info from /auth/me", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "pro",
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
        subscription: {
          status: "canceled",
          expires_at: "2026-07-15T00:00:00Z",
        },
      },
      requireAuth: false,
      billingEnabled: false,
    });
  });

  it("maps expired subscription without expires_at", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "pro",
        subscription: { status: "canceled" },
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: {
        id: "user-1",
        plan: "pro",
        subscription: { status: "canceled" },
      },
      requireAuth: false,
      billingEnabled: false,
    });
  });

  it("omits subscription when field is absent", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "free",
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: { id: "user-1", plan: "free" },
      requireAuth: false,
      billingEnabled: false,
    });
  });

  it("ignores malformed subscription payloads", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "pro",
        subscription: { status: 42, expires_at: "2026-07-15T00:00:00Z" },
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: { id: "user-1", plan: "pro" },
      requireAuth: false,
      billingEnabled: false,
    });
  });

  it("maps require_auth from authenticated /auth/me", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "free",
        require_auth: true,
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: { id: "user-1", plan: "free" },
      requireAuth: true,
      billingEnabled: false,
    });
  });

  it("maps billing_enabled from authenticated /auth/me", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        plan: "free",
        billing_enabled: true,
      }),
    });

    const result = await probeAuth();

    expect(result).toEqual({
      mode: "cloud",
      user: { id: "user-1", plan: "free" },
      requireAuth: false,
      billingEnabled: true,
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
      billingEnabled: false,
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
