import { ApiError } from "../client";
import type { CloudResumeRow, ImportResumeItem } from "../resumes";
import {
  createCloudResume,
  deleteCloudResume,
  getCloudResume,
  importResumes,
  listCloudResumes,
  parseApiErrorBody,
  ResumeVersionConflictError,
  updateCloudResume,
  upsertCloudResume,
} from "../resumes";
import { createDefaultResume } from "../../wasm/defaults";
import type { ResumeData } from "../../wasm/types";

function testResume(name: string): ResumeData {
  const resume = createDefaultResume();
  resume.basics.name = name;
  return resume;
}

function mockRow(overrides: Partial<CloudResumeRow> = {}): CloudResumeRow {
  return {
    id: "abc",
    title: "Test",
    updated_at: "2026-01-01T00:00:00Z",
    user_id: "user-1",
    data: testResume("Test"),
    is_public: false,
    public_slug: null,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function jsonFetch(body: unknown) {
  return {
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
  };
}

const originalFetch = globalThis.fetch;

describe("upsertCloudResume", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the updated row when the resume already exists", async () => {
    const row = mockRow({ id: "abc", title: "Updated" });
    globalThis.fetch = vi.fn().mockResolvedValue(jsonFetch(row));

    const result = await upsertCloudResume("abc", testResume("Test"), "Test");

    expect(result).toEqual(row);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/resumes/abc",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("creates and returns the row when update returns 404", async () => {
    const created = mockRow({ id: "abc", title: "Created" });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Resume not found"),
      })
      .mockResolvedValueOnce(jsonFetch(created));

    const result = await upsertCloudResume("abc", testResume("Test"), "Test");

    expect(result).toEqual(created);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-404 update failures", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("boom"),
    });

    await expect(upsertCloudResume("abc", testResume("Test"), "Test")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("passes version through to update requests", async () => {
    const resumeData = testResume("Test");
    const row = mockRow({ id: "abc", version: 4 });
    const mockFetch = vi.fn().mockResolvedValue(jsonFetch(row));
    globalThis.fetch = mockFetch;

    const result = await upsertCloudResume("abc", resumeData, "Test", 3);

    expect(result).toEqual(row);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes/abc",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ title: "Test", data: resumeData, version: 3 }),
      }),
    );
  });

  it("propagates ResumeVersionConflictError without retrying create", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: "Resume was modified by another session",
            current_version: 5,
          }),
        ),
    });

    await expect(upsertCloudResume("abc", testResume("Test"), "Test", 3)).rejects.toBeInstanceOf(
      ResumeVersionConflictError,
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries update when create returns 409 after a 404 update", async () => {
    const updated = mockRow({ id: "abc", title: "Test" });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Resume not found"),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
        text: () => Promise.resolve("A resume with this ID already exists"),
      })
      .mockResolvedValueOnce(jsonFetch(updated));

    const result = await upsertCloudResume("abc", testResume("Test"), "Test");

    expect(result).toEqual(updated);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      "/api/resumes/abc",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

describe("resume API helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("listCloudResumes follows paginated responses", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonFetch({
          items: [{ id: "1", title: "One", updated_at: "2026-01-01T00:00:00Z" }],
          total: 2,
          page: 1,
          per_page: 100,
        }),
      )
      .mockResolvedValueOnce(
        jsonFetch({
          items: [{ id: "2", title: "Two", updated_at: "2026-01-02T00:00:00Z" }],
          total: 2,
          page: 2,
          per_page: 100,
        }),
      );
    globalThis.fetch = mockFetch;

    const result = await listCloudResumes();

    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]?.[0]).toContain("/api/resumes?page=1&per_page=100");
  });

  it("getCloudResume calls GET /api/resumes/:id", async () => {
    const row = mockRow({ id: "abc" });
    const mockFetch = vi.fn().mockResolvedValue(jsonFetch(row));
    globalThis.fetch = mockFetch;

    const result = await getCloudResume("abc");

    expect(result).toEqual(row);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes/abc",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("deleteCloudResume calls DELETE /api/resumes/:id", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: () => Promise.resolve(""),
    });
    globalThis.fetch = mockFetch;

    await deleteCloudResume("abc");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes/abc",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("createCloudResume posts JSON body", async () => {
    const body = { title: "Mine", data: testResume("A") };
    const mockFetch = vi.fn().mockResolvedValue(jsonFetch({ id: "1", title: "Mine" }));
    globalThis.fetch = mockFetch;

    await createCloudResume(body);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  });

  it("updateCloudResume puts to the resume id path", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonFetch({ id: "abc" }));
    globalThis.fetch = mockFetch;

    await updateCloudResume("abc", { data: createDefaultResume() });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes/abc",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("updateCloudResume sends version when provided", async () => {
    const resumeData = createDefaultResume();
    const mockFetch = vi.fn().mockResolvedValue(jsonFetch(mockRow({ version: 4 })));
    globalThis.fetch = mockFetch;

    await updateCloudResume("abc", { data: resumeData, version: 3 });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes/abc",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ data: resumeData, version: 3 }),
      }),
    );
  });

  it("updateCloudResume throws ResumeVersionConflictError on version mismatch", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: "Resume was modified by another session",
            current_version: 5,
          }),
        ),
    });

    await expect(
      updateCloudResume("abc", { data: createDefaultResume(), version: 3 }),
    ).rejects.toBeInstanceOf(ResumeVersionConflictError);
  });

  it("importResumes posts the import payload", async () => {
    const payload: ImportResumeItem[] = [{ title: "One", data: createDefaultResume() }];
    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonFetch({ imported: [{ id: "1", title: "One" }], failed: [] }));
    globalThis.fetch = mockFetch;

    const result = await importResumes(payload);

    expect(result.imported).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/resumes/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resumes: payload }),
      }),
    );
  });

  it("importResumes collects batch failures without stopping", async () => {
    const payload: ImportResumeItem[] = [{ title: "One", data: createDefaultResume() }];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("boom"),
    });
    globalThis.fetch = mockFetch;

    const result = await importResumes(payload);

    expect(result.imported).toEqual([]);
    expect(result.failures).toHaveLength(1);
  });

  it("importResumes chunks large batches to the server limit", async () => {
    const payload: ImportResumeItem[] = Array.from({ length: 101 }, (_, index) => ({
      id: `resume-${index}`,
      title: `Resume ${index}`,
      data: createDefaultResume(),
    }));
    const mockFetch = vi.fn().mockResolvedValue(jsonFetch({ imported: [], failed: [] }));
    globalThis.fetch = mockFetch;

    await importResumes(payload);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resumes: payload.slice(0, 100) }),
      }),
    );
    expect(mockFetch.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resumes: payload.slice(100) }),
      }),
    );
  });
});

describe("parseApiErrorBody", () => {
  it("parses version conflict payloads", () => {
    expect(
      parseApiErrorBody(
        JSON.stringify({
          error: "Resume was modified by another session",
          current_version: 5,
        }),
      ),
    ).toEqual({
      error: "Resume was modified by another session",
      current_version: 5,
    });
  });

  it("returns null for non-json bodies", () => {
    expect(parseApiErrorBody("plain text")).toBeNull();
  });
});
