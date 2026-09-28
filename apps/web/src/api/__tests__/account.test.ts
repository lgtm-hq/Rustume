import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiValidationError } from "../client";
import { deleteAccount, downloadAccountExport } from "../account";

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

describe("downloadAccountExport", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("downloads account export JSON via blob link", async () => {
    const click = vi.fn();
    const createObjectURL = vi.fn(() => "blob:account-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const anchor = {
      click,
      href: "",
      download: "",
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor);
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    vi.useFakeTimers();

    try {
      const exportBlob = new Blob(['{"exported_at":"2026-06-15T12:00:00Z"}'], {
        type: "application/json",
      });
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => exportBlob,
      });

      const downloadPromise = downloadAccountExport();
      await vi.runAllTimersAsync();
      await downloadPromise;

      expect(fetchMock).toHaveBeenCalledWith("/api/account/export", {
        credentials: "include",
        method: "GET",
      });
      // The bytes handed to the browser are exactly the response body.
      expect(createObjectURL).toHaveBeenCalledWith(exportBlob);
      expect(click).toHaveBeenCalled();
      expect(anchor.download).toBe("rustume-account-export.json");
      expect(anchor.remove).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:account-export");
    } finally {
      vi.useRealTimers();
      appendChild.mockRestore();
      createElement.mockRestore();
    }
  });

  it("throws when the server rejects account export", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Not authenticated" }),
    });

    const error = await downloadAccountExport().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe("Not authenticated");
  });

  it("surfaces the export concurrency ceiling as a 503 ApiError", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers({ "Retry-After": "30" }),
      text: async () =>
        JSON.stringify({
          error: "Too many account exports are running right now. Please try again shortly.",
          retry_after: 30,
        }),
    });

    const error = await downloadAccountExport().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect((error as ApiError).message).toBe(
      "Too many account exports are running right now. Please try again shortly.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the export rate limit as a 429 ApiError without retrying", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "12" }),
      text: async () =>
        JSON.stringify({ error: "Too many requests. Please try again shortly.", retry_after: 12 }),
    });

    const error = await downloadAccountExport().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).message).toBe("Too many requests. Please try again shortly.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
