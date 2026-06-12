import { createRoot } from "solid-js";
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
    cloudEnabled: true,
    user: { id: "user-1", plan: "free" },
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

vi.mock("../../wasm", () => ({
  listResumes: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  deleteResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  getResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  saveResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  resumeExists: vi.fn().mockResolvedValue(false),
  isWasmReady: () => false,
}));

vi.mock("../../components/ui", () => ({
  toast: toastMocks,
}));

import * as cloudStorage from "../cloudStorage";
import { useResumeList } from "../persistence";

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

describe("persistence store - cloud renameResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "user-1", plan: "free" };
    resumeApiMocks.listCloudResumes.mockResolvedValue([]);
    resumeApiMocks.getCloudResume.mockResolvedValue(mockRow({ id: "resume-1" }));
  });

  it("does not show generic error toast when cloud writes are blocked", async () => {
    vi.spyOn(cloudStorage, "renameCloudResume").mockRejectedValueOnce(
      new cloudStorage.CloudWriteBlockedError("resume-1"),
    );

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();

        await expect(store.renameResume("resume-1", "New Title")).rejects.toBeInstanceOf(
          cloudStorage.CloudWriteBlockedError,
        );

        expect(toastMocks.error).not.toHaveBeenCalledWith("Failed to rename resume");
      } finally {
        dispose();
      }
    });
  });
});
