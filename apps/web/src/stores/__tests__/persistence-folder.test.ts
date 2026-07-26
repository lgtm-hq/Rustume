import type { CloudResumeRow } from "../../api/resumes";
import { createDefaultResume } from "../../wasm/defaults";
import type { ResumeData } from "../../wasm/types";

function createMockStorage(): Storage {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return key in store ? store[key] : null;
    },
    key(index: number) {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  };
}

const mockStorage = createMockStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

const { mockAuthState, resumeApiMocks, toastMocks } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: false,
    user: null as { id: string; plan: string } | null,
  },
  resumeApiMocks: {
    listCloudResumes: vi.fn(),
    getCloudResume: vi.fn(),
    createCloudResume: vi.fn(),
    updateCloudResume: vi.fn(),
    deleteCloudResume: vi.fn(),
    upsertCloudResume: vi.fn(),
  },
  toastMocks: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
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

// WASM never becomes ready, so the local path falls back to localStorage.
vi.mock("../../wasm", () => ({
  listResumes: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  deleteResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  getResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  saveResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  resumeExists: vi.fn().mockResolvedValue(false),
  isWasmReady: () => false,
  ensureWasmReady: async () => false,
}));

vi.mock("../../components/ui", () => ({
  toast: toastMocks,
}));

import { createRoot } from "solid-js";
import { getResumeMeta, patchResumeListMeta, useResumeList } from "../persistence";

const RESUME_ID = "resume-1";

function testResume(): ResumeData {
  const resume = createDefaultResume();
  resume.basics.name = "Jane Doe";
  return resume;
}

function mockRow(data: ResumeData): CloudResumeRow {
  return {
    id: RESUME_ID,
    title: "My Resume",
    updated_at: "2026-01-01T00:00:00Z",
    user_id: "user-1",
    data,
    is_public: false,
    public_slug: null,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
  };
}

/** Seed a resume into the localStorage-backed store. */
function seedLocalResume(data: ResumeData): void {
  localStorage.setItem(`rustume:${RESUME_ID}`, JSON.stringify(data));
  localStorage.setItem("rustume:_ids", JSON.stringify([RESUME_ID]));
}

/** Re-read the resume exactly as a fresh page load would. */
function readLocalResume(): ResumeData {
  return JSON.parse(localStorage.getItem(`rustume:${RESUME_ID}`) ?? "{}") as ResumeData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.clear();
  mockAuthState.loading = false;
  mockAuthState.cloudEnabled = false;
  mockAuthState.user = null;
});

describe("folder assignment - local storage", () => {
  it("files a resume into a folder that survives a reload", async () => {
    seedLocalResume(testResume());

    await patchResumeListMeta(RESUME_ID, { folder: "Applications" });

    // On the resume itself, so it travels with the resume...
    expect(readLocalResume().metadata.folder).toBe("Applications");
    // ...and in the list metadata the home page reads.
    expect(getResumeMeta(RESUME_ID)?.folder).toBe("Applications");
  });

  it("unfiles a resume without deleting it when the folder is cleared", async () => {
    const resume = testResume();
    resume.metadata.folder = "Applications";
    seedLocalResume(resume);

    await patchResumeListMeta(RESUME_ID, { folder: null });

    // Absent rather than an empty string: unfiled is the absence of a folder.
    expect(readLocalResume().metadata.folder).toBeUndefined();
    expect(getResumeMeta(RESUME_ID)?.folder).toBeUndefined();
    // The resume itself is untouched.
    expect(readLocalResume().basics.name).toBe("Jane Doe");
  });

  it("reassigns a filed resume to a different folder", async () => {
    const resume = testResume();
    resume.metadata.folder = "Applications";
    seedLocalResume(resume);

    await patchResumeListMeta(RESUME_ID, { folder: "Consulting" });

    expect(readLocalResume().metadata.folder).toBe("Consulting");
    expect(getResumeMeta(RESUME_ID)?.folder).toBe("Consulting");
  });

  it("leaves the folder alone when patching an unrelated field", async () => {
    const resume = testResume();
    resume.metadata.folder = "Applications";
    seedLocalResume(resume);

    await patchResumeListMeta(RESUME_ID, { locked: true });

    expect(readLocalResume().metadata.folder).toBe("Applications");
    expect(getResumeMeta(RESUME_ID)?.folder).toBe("Applications");
  });

  it("keeps folders independent of tags", async () => {
    seedLocalResume(testResume());

    await patchResumeListMeta(RESUME_ID, { folder: "Applications" });
    await patchResumeListMeta(RESUME_ID, { tags: ["backend", "design"] });

    const stored = readLocalResume();
    expect(stored.metadata.folder).toBe("Applications");
    expect(stored.metadata.tags).toEqual(["backend", "design"]);
  });
});

describe("folder recovery from the resume itself", () => {
  it("rebuilds a lost metadata cache from the folder stored on the resume", async () => {
    const resume = testResume();
    resume.metadata.folder = "Applications";
    seedLocalResume(resume);

    // Simulate a cleared metadata cache with the resume still on disk.
    localStorage.removeItem("rustume:_meta");
    expect(getResumeMeta(RESUME_ID)).toBeNull();

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();
        const items = store.resumes();
        expect(items?.[0]?.folder).toBe("Applications");
      } finally {
        dispose();
      }
    });

    // ...and the recovered folder is written back to the cache.
    expect(getResumeMeta(RESUME_ID)?.folder).toBe("Applications");
  });
});

describe("folder assignment - cloud metadata path", () => {
  beforeEach(() => {
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "user-1", plan: "free" };
  });

  it("sends the folder to the cloud so it is not stranded on one device", async () => {
    const remote = testResume();
    resumeApiMocks.getCloudResume.mockResolvedValue(mockRow(remote));
    resumeApiMocks.upsertCloudResume.mockImplementation((_id, data: ResumeData) =>
      Promise.resolve(mockRow(data)),
    );

    await patchResumeListMeta(RESUME_ID, { folder: "Applications" });

    expect(resumeApiMocks.upsertCloudResume).toHaveBeenCalledTimes(1);
    const [, sent] = resumeApiMocks.upsertCloudResume.mock.calls[0] as [string, ResumeData];
    expect(sent.metadata.folder).toBe("Applications");
  });

  it("reads a folder assigned on another device back off the cloud resume", async () => {
    const remote = testResume();
    remote.metadata.folder = "Consulting";
    resumeApiMocks.getCloudResume.mockResolvedValue(mockRow(remote));
    resumeApiMocks.upsertCloudResume.mockImplementation((_id, data: ResumeData) =>
      Promise.resolve(mockRow(data)),
    );

    // Touching an unrelated field must preserve the folder that arrived remotely.
    await patchResumeListMeta(RESUME_ID, { locked: true });

    const [, sent] = resumeApiMocks.upsertCloudResume.mock.calls[0] as [string, ResumeData];
    expect(sent.metadata.folder).toBe("Consulting");
    // ...and it lands in the list metadata the rail counts from.
    expect(getResumeMeta(RESUME_ID)?.folder).toBe("Consulting");
  });

  it("clears the folder in the cloud when a resume is unfiled", async () => {
    const remote = testResume();
    remote.metadata.folder = "Applications";
    resumeApiMocks.getCloudResume.mockResolvedValue(mockRow(remote));
    resumeApiMocks.upsertCloudResume.mockImplementation((_id, data: ResumeData) =>
      Promise.resolve(mockRow(data)),
    );

    await patchResumeListMeta(RESUME_ID, { folder: null });

    const [, sent] = resumeApiMocks.upsertCloudResume.mock.calls[0] as [string, ResumeData];
    expect(sent.metadata.folder).toBeUndefined();
    expect(getResumeMeta(RESUME_ID)?.folder).toBeUndefined();
  });
});
