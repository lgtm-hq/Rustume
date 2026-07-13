import { ApiError } from "../client";
import { fetchPublicResume, updateSharing } from "../sharing";
import { createDefaultResume } from "../../wasm/defaults";

function jsonFetch(body: unknown) {
  return {
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
  };
}

const originalFetch = globalThis.fetch;

describe("sharing API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("updateSharing sends PUT with is_public body", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonFetch({ is_public: true, public_slug: "abc123" }));
    globalThis.fetch = mockFetch;

    const result = await updateSharing("resume-1", true);

    expect(result).toEqual({ is_public: true, public_slug: "abc123" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes/resume-1/sharing",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ is_public: true }),
      }),
    );
  });

  it("updateSharing propagates ApiError responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: () => Promise.resolve("forbidden"),
    });

    await expect(updateSharing("resume-1", true)).rejects.toBeInstanceOf(ApiError);
  });

  it("fetchPublicResume requests /r/{slug}/data", async () => {
    const resume = createDefaultResume();
    const mockFetch = vi.fn().mockResolvedValue(
      jsonFetch({
        id: "resume-1",
        title: "Public Resume",
        data: resume,
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    globalThis.fetch = mockFetch;

    const result = await fetchPublicResume("my-slug");

    expect(result.title).toBe("Public Resume");
    expect(mockFetch).toHaveBeenCalledWith("/r/my-slug/data");
  });

  it("fetchPublicResume encodes slug path segments", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonFetch({
        id: "resume-1",
        title: "Encoded",
        data: createDefaultResume(),
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    globalThis.fetch = mockFetch;

    await fetchPublicResume("a/b");

    expect(mockFetch).toHaveBeenCalledWith("/r/a%2Fb/data");
  });

  it("fetchPublicResume throws ApiError on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve("Resume not found"),
    });

    await expect(fetchPublicResume("missing")).rejects.toBeInstanceOf(ApiError);
  });
});
