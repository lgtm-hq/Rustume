import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { downloadResumesJson, exportResumesJson } from "../export";

describe("export API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("parses bulk JSON export", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        exported_at: "2026-06-15T12:00:00Z",
        resumes: [{ id: "resume-1", title: "Engineer", data: { basics: { name: "Ada" } } }],
      }),
    });

    await expect(exportResumesJson()).resolves.toEqual({
      exported_at: "2026-06-15T12:00:00Z",
      resumes: [{ id: "resume-1", title: "Engineer", data: { basics: { name: "Ada" } } }],
    });
  });

  it("throws ApiError with server message on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => JSON.stringify({ error: "Cloud subscription expired" }),
    });

    await expect(exportResumesJson()).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Cloud subscription expired",
    });
  });

  it("downloads JSON via blob link", async () => {
    const click = vi.fn();
    const createObjectURL = vi.fn(() => "blob:export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const anchor = { click, href: "", download: "", remove: vi.fn() } as HTMLAnchorElement;
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor);
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    vi.useFakeTimers();

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        exported_at: "2026-06-15T12:00:00Z",
        resumes: [],
      }),
    });

    const downloadPromise = downloadResumesJson();
    await vi.runAllTimersAsync();
    await downloadPromise;

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
    vi.useRealTimers();
    appendChild.mockRestore();
    createElement.mockRestore();
  });
});
