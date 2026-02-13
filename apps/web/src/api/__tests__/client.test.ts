import { get, post, fetchBlob, ApiError } from "../client";

describe("ApiError", () => {
  it("has status and message properties", () => {
    const error = new ApiError(404, "Not Found");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not Found");
  });
});

describe("get", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes GET request to /api/{endpoint}", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: "test" }),
    });
    globalThis.fetch = mockFetch;

    await get("/templates");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/templates",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("parses JSON response", async () => {
    const responseData = { templates: ["rhyhorn", "gengar"] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(responseData),
    });

    const result = await get("/templates");

    expect(result).toEqual(responseData);
  });

  it("throws ApiError on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("Something went wrong"),
    });

    await expect(get("/templates")).rejects.toThrow(ApiError);
    await expect(get("/templates")).rejects.toMatchObject({
      status: 500,
      message: "Something went wrong",
    });
  });

  it("does not set Content-Type header for GET requests without body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });
    globalThis.fetch = mockFetch;

    await get("/test");

    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders["Content-Type"]).toBeUndefined();
  });
});

describe("post", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes POST request with JSON body and Content-Type header", async () => {
    const body = { resume: { name: "Test" } };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ success: true }),
    });
    globalThis.fetch = mockFetch;

    await post("/render", body);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/render",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders["Content-Type"]).toBe("application/json");
  });

  it("sets Content-Type even when body is undefined", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });
    globalThis.fetch = mockFetch;

    await post("/action");

    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders["Content-Type"]).toBe("application/json");
  });
});

describe("fetchBlob", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Blob from response", async () => {
    const mockBlob = new Blob(["pdf-content"], { type: "application/pdf" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    const result = await fetchBlob("/render/preview", { resume: {} });

    expect(result).toBe(mockBlob);
  });

  it("throws ApiError on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      text: () => Promise.resolve("Invalid resume data"),
    });

    await expect(fetchBlob("/render/preview", { resume: {} })).rejects.toThrow(ApiError);
    await expect(fetchBlob("/render/preview", { resume: {} })).rejects.toMatchObject({
      status: 422,
      message: "Invalid resume data",
    });
  });
});
