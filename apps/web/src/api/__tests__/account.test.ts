import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiValidationError } from "../client";
import { deleteAccount, updateUsername, validateUsername } from "../account";
import usernameCases from "../../../../../crates/server/src/auth/username_cases.json";
import usernameRules from "../../../../../crates/server/src/auth/username_rules.json";

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
  const messages = usernameRules.messages;
  const expected = (key: string): string | null => {
    switch (key) {
      case "ok":
        return null;
      case "length":
        return messages.length
          .replace("{min}", String(usernameRules.min_length))
          .replace("{max}", String(usernameRules.max_length));
      case "charset":
        return messages.charset;
      case "hyphens":
        return messages.hyphens;
      case "reserved":
        return messages.reserved;
      default:
        throw new Error(`unknown expectation ${key} in username_cases.json`);
    }
  };

  // The same vectors drive crates/server/src/auth/username.rs, so the client
  // and server validators cannot diverge in behaviour.
  it.each(usernameCases.cases.map((c) => [c.input, c.expect] as const))(
    "shared case %j -> %s",
    (input, expect_) => {
      expect(validateUsername(input)).toBe(expected(expect_));
    },
  );

  it("covers every rule at least once", () => {
    const kinds = new Set(usernameCases.cases.map((c) => c.expect));
    expect([...kinds].sort()).toEqual(["charset", "hyphens", "length", "ok", "reserved"]);
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
