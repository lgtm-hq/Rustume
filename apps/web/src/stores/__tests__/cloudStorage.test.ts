import { ApiError } from "../../api/client";
import type { CloudResumeRow, CloudResumeSummary } from "../../api/resumes";
import { ResumeVersionConflictError } from "../../api/resumes";
import { createDefaultResume } from "../../wasm/defaults";
import type { ResumeData } from "../../wasm/types";
import { ResumeCorruptedError, ResumeNotFoundError } from "../resume";

const { mockAuthState, resumeApiMocks } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    user: {
      id: "user-1",
      plan: "free",
    },
  },
  resumeApiMocks: {
    listCloudResumes: vi.fn(),
    getCloudResume: vi.fn(),
    createCloudResume: vi.fn(),
    updateCloudResume: vi.fn(),
    deleteCloudResume: vi.fn(),
    upsertCloudResume: vi.fn(),
  },
}));

vi.mock("../auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
  },
}));

vi.mock("../../api/resumes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/resumes")>();
  return {
    ...actual,
    ...resumeApiMocks,
  };
});

import {
  clearCloudResumeVersion,
  clearCloudWriteBlock,
  cloudResumeExists,
  CloudWriteBlockedError,
  createCloudResumeWithId,
  duplicateCloudResume,
  getCloudResumeVersion,
  isCloudAuthenticated,
  isCloudWriteBlocked,
  listCloudResumeSummaries,
  loadCloudResume,
  removeCloudResume,
  renameCloudResume,
  saveCloudResume,
  setCloudResumeVersion,
} from "../cloudStorage";

function testResume(name: string): ResumeData {
  const resume = createDefaultResume();
  resume.basics.name = name;
  return resume;
}

function mockRow(overrides: Partial<CloudResumeRow> = {}): CloudResumeRow {
  return {
    id: "resume-1",
    title: "My Resume",
    updated_at: "2026-01-01T00:00:00Z",
    user_id: "user-1",
    data: testResume("Jane Doe"),
    is_public: false,
    public_slug: null,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("isCloudAuthenticated", () => {
  beforeEach(() => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
    };
  });

  it.each([
    {
      label: "authenticated cloud user",
      loading: false,
      cloudEnabled: true,
      user: {},
      expected: true,
    },
    { label: "still loading", loading: true, cloudEnabled: true, user: {}, expected: false },
    { label: "cloud disabled", loading: false, cloudEnabled: false, user: {}, expected: false },
    { label: "signed out", loading: false, cloudEnabled: true, user: null, expected: false },
  ])("returns $expected when $label", ({ loading, cloudEnabled, user, expected }) => {
    mockAuthState.loading = loading;
    mockAuthState.cloudEnabled = cloudEnabled;
    mockAuthState.user = user as typeof mockAuthState.user;

    expect(isCloudAuthenticated()).toBe(expected);
  });
});

describe("listCloudResumeSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to listCloudResumes", async () => {
    const summaries: CloudResumeSummary[] = [
      { id: "1", title: "One", updated_at: "2026-01-01T00:00:00Z" },
    ];
    resumeApiMocks.listCloudResumes.mockResolvedValue(summaries);

    await expect(listCloudResumeSummaries()).resolves.toEqual(summaries);
    expect(resumeApiMocks.listCloudResumes).toHaveBeenCalledOnce();
  });
});

describe("loadCloudResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated resume data from the cloud row", async () => {
    const row = mockRow({ id: "abc", data: testResume("Loaded Name"), version: 7 });
    resumeApiMocks.getCloudResume.mockResolvedValue(row);

    const data = await loadCloudResume("abc");

    expect(resumeApiMocks.getCloudResume).toHaveBeenCalledWith("abc");
    expect(data.basics.name).toBe("Loaded Name");
    expect(getCloudResumeVersion("abc")).toBe(7);
  });

  it("maps 404 ApiError to ResumeNotFoundError", async () => {
    resumeApiMocks.getCloudResume.mockRejectedValue(new ApiError(404, "Resume not found"));

    await expect(loadCloudResume("missing")).rejects.toBeInstanceOf(ResumeNotFoundError);
  });

  it("rethrows non-404 errors", async () => {
    resumeApiMocks.getCloudResume.mockRejectedValue(new ApiError(500, "Server error"));

    await expect(loadCloudResume("abc")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ResumeCorruptedError when cloud data is invalid", async () => {
    resumeApiMocks.getCloudResume.mockResolvedValue(mockRow({ data: { invalid: true } as never }));

    await expect(loadCloudResume("bad")).rejects.toBeInstanceOf(ResumeCorruptedError);
  });
});

describe("saveCloudResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCloudResumeVersion("abc");
    clearCloudWriteBlock("abc");
  });

  it("upserts with the provided title", async () => {
    const data = testResume("Save Me");
    resumeApiMocks.upsertCloudResume.mockResolvedValue(
      mockRow({ title: "Custom Title", version: 2 }),
    );

    await saveCloudResume("abc", data, "Custom Title");

    expect(resumeApiMocks.upsertCloudResume).toHaveBeenCalledWith(
      "abc",
      data,
      "Custom Title",
      undefined,
    );
    expect(getCloudResumeVersion("abc")).toBe(2);
  });

  it("derives title from resume data when title is omitted", async () => {
    const data = testResume("Derived Name");
    resumeApiMocks.upsertCloudResume.mockResolvedValue(mockRow({ version: 3 }));

    await saveCloudResume("abc", data);

    expect(resumeApiMocks.upsertCloudResume).toHaveBeenCalledWith(
      "abc",
      data,
      "Derived Name",
      undefined,
    );
    expect(getCloudResumeVersion("abc")).toBe(3);
  });

  it("sends tracked version on save", async () => {
    const data = testResume("Versioned");
    setCloudResumeVersion("abc", 4);
    resumeApiMocks.upsertCloudResume.mockResolvedValue(mockRow({ version: 5 }));

    await saveCloudResume("abc", data, "Versioned");

    expect(resumeApiMocks.upsertCloudResume).toHaveBeenCalledWith("abc", data, "Versioned", 4);
    expect(getCloudResumeVersion("abc")).toBe(5);
  });

  it("propagates version conflict errors without updating cached version", async () => {
    const data = testResume("Conflict");
    setCloudResumeVersion("abc", 2);
    resumeApiMocks.upsertCloudResume.mockRejectedValue(
      new ResumeVersionConflictError("Resume was modified by another session", 5),
    );

    await expect(saveCloudResume("abc", data)).rejects.toBeInstanceOf(ResumeVersionConflictError);
    expect(getCloudResumeVersion("abc")).toBe(2);
    expect(isCloudWriteBlocked("abc")).toBe(true);
  });

  it("blocks subsequent writes after a version conflict until reload", async () => {
    const data = testResume("Blocked");
    setCloudResumeVersion("abc", 2);
    resumeApiMocks.upsertCloudResume.mockRejectedValue(
      new ResumeVersionConflictError("Resume was modified by another session", 5),
    );

    await expect(saveCloudResume("abc", data)).rejects.toBeInstanceOf(ResumeVersionConflictError);

    await expect(saveCloudResume("abc", data)).rejects.toBeInstanceOf(CloudWriteBlockedError);
    expect(resumeApiMocks.upsertCloudResume).toHaveBeenCalledTimes(1);
  });
});

describe("createCloudResumeWithId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates with explicit id and title", async () => {
    const data = testResume("New");
    resumeApiMocks.createCloudResume.mockResolvedValue(mockRow());

    await createCloudResumeWithId("new-id", data, "Explicit Title");

    expect(resumeApiMocks.createCloudResume).toHaveBeenCalledWith({
      id: "new-id",
      title: "Explicit Title",
      data,
    });
  });

  it("derives title when omitted", async () => {
    const data = testResume("Auto Title");
    resumeApiMocks.createCloudResume.mockResolvedValue(mockRow());

    await createCloudResumeWithId("new-id", data);

    expect(resumeApiMocks.createCloudResume).toHaveBeenCalledWith({
      id: "new-id",
      title: "Auto Title",
      data,
    });
  });
});

describe("removeCloudResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to deleteCloudResume", async () => {
    resumeApiMocks.deleteCloudResume.mockResolvedValue(undefined);

    await removeCloudResume("abc");

    expect(resumeApiMocks.deleteCloudResume).toHaveBeenCalledWith("abc");
  });
});

describe("renameCloudResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates title without sending resume data", async () => {
    setCloudResumeVersion("abc", 2);
    resumeApiMocks.updateCloudResume.mockResolvedValue(mockRow({ title: "New Title", version: 3 }));

    await renameCloudResume("abc", "New Title");

    expect(resumeApiMocks.updateCloudResume).toHaveBeenCalledWith("abc", {
      title: "New Title",
      version: 2,
    });
    expect(getCloudResumeVersion("abc")).toBe(3);
  });
});

describe("duplicateCloudResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new cloud resume with the duplicate id", async () => {
    const data = testResume("Copy");
    resumeApiMocks.createCloudResume.mockResolvedValue(mockRow({ id: "copy-id" }));

    await duplicateCloudResume("source-id", "copy-id", data, "Copy Title");

    expect(resumeApiMocks.createCloudResume).toHaveBeenCalledWith({
      id: "copy-id",
      title: "Copy Title",
      data,
    });
  });
});

describe("cloudResumeExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when getCloudResume succeeds", async () => {
    resumeApiMocks.getCloudResume.mockResolvedValue(mockRow());

    await expect(cloudResumeExists("abc")).resolves.toBe(true);
  });

  it("returns false when getCloudResume returns 404", async () => {
    resumeApiMocks.getCloudResume.mockRejectedValue(new ApiError(404, "Not found"));

    await expect(cloudResumeExists("missing")).resolves.toBe(false);
  });

  it("rethrows non-404 errors", async () => {
    resumeApiMocks.getCloudResume.mockRejectedValue(new ApiError(500, "Server error"));

    await expect(cloudResumeExists("abc")).rejects.toBeInstanceOf(ApiError);
  });
});
