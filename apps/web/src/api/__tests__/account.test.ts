import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiValidationError } from "../client";
import { deleteAccount, updateUsername, validateUsername } from "../account";

describe("deleteAccount", () => {
  it("sends DELETE with confirmation body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        deleted: true,
        message: "Account and all data permanently deleted.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteAccount("DELETE");

    expect(fetchMock).toHaveBeenCalledWith("/api/account", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    expect(result.deleted).toBe(true);
  });

  it("throws when the server rejects deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "Type DELETE to confirm account deletion" }),
      }),
    );

    await expect(deleteAccount("delete")).rejects.toThrow(
      "Type DELETE to confirm account deletion",
    );
  });

  it("rejects malformed delete responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ deleted: "yes" }),
      }),
    );

    await expect(deleteAccount("DELETE")).rejects.toThrow(ApiValidationError);
  });
});

describe("validateUsername", () => {
  it("accepts valid usernames", () => {
    expect(validateUsername("swift-otter-4821")).toBeNull();
    expect(validateUsername("ada")).toBeNull();
  });

  it("rejects invalid charset", () => {
    expect(validateUsername("user_name")).toBe(
      "Username may only contain lowercase letters, digits, and hyphens",
    );
  });

  it("rejects reserved usernames", () => {
    expect(validateUsername("admin")).toBe("Username is reserved");
  });

  it.each([
    ["ab", "Username must be 3-32 characters"],
    ["a".repeat(33), "Username must be 3-32 characters"],
    ["-swift", "Username cannot start, end, or contain consecutive hyphens"],
    ["swift-", "Username cannot start, end, or contain consecutive hyphens"],
    ["swift--otter", "Username cannot start, end, or contain consecutive hyphens"],
  ])("rejects %s with the shared length/hyphen rules", (input, message) => {
    expect(validateUsername(input)).toBe(message);
  });

  it.each(["abc", "a".repeat(32), "user-42", "a1b2c3"])("accepts boundary input %s", (input) => {
    expect(validateUsername(input)).toBeNull();
  });
});

describe("updateUsername", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("sends PATCH and returns the updated username on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ username: "calm-finch-1234" }),
    });

    await expect(updateUsername("calm-finch-1234")).resolves.toEqual({
      username: "calm-finch-1234",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/account", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "calm-finch-1234" }),
    });
  });

  it("surfaces a 409 conflict message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ error: "username already taken" }),
    });

    await expect(updateUsername("taken-handle")).rejects.toThrow("username already taken");
  });

  it("rejects update responses with unexpected fields", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ username: "calm-finch-1234", extra: true }),
    });

    await expect(updateUsername("calm-finch-1234")).rejects.toThrow(ApiValidationError);
  });

  it("rejects malformed update responses", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ username: 42 }),
    });

    await expect(updateUsername("calm-finch-1234")).rejects.toThrow(ApiValidationError);
  });
});
