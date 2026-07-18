import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { updateUsername, validateUsername } from "../account";

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

  it("returns the updated username on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ username: "calm-finch-1234" }),
    });

    await expect(updateUsername("calm-finch-1234")).resolves.toEqual({
      username: "calm-finch-1234",
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
});
