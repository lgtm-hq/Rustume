import { createRoot } from "solid-js";

// ---------------------------------------------------------------------------
// Provide a full in-memory localStorage implementation so the persistence
// store can use it normally even when the vitest jsdom environment does not
// ship a working one.
// ---------------------------------------------------------------------------

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

// Install mock before any module-level code in the SUT runs.
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

// Mock the WASM module so every code-path falls back to localStorage.
vi.mock("../../wasm", () => ({
  listResumes: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  deleteResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  resumeExists: vi.fn().mockResolvedValue(false),
  isWasmReady: () => false,
}));

// Re-import after mock is in place.
import { useResumeList } from "../persistence";

const STORAGE_KEY_PREFIX = "rustume:";

describe("persistence store - localStorage fallback path", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  // -------------------------------------------------------------------
  // listLocalResumes (tested through public API)
  // -------------------------------------------------------------------

  it("returns empty array when no data in localStorage", async () => {
    await createRoot(async (dispose) => {
      try {
        const { resumes, refresh } = useResumeList();

        // Wait for the initial fetch triggered by createResource to settle.
        await refresh();

        const list = resumes();
        expect(list).toBeDefined();
        expect(list).toHaveLength(0);
      } finally {
        dispose();
      }
    });
  });

  it("returns stored IDs after setting localStorage", async () => {
    // Pre-populate localStorage with resume IDs
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["abc-123", "def-456"]));

    await createRoot(async (dispose) => {
      try {
        const { resumes, refresh } = useResumeList();

        await refresh();

        const list = resumes();
        expect(list).toBeDefined();
        expect(list).toHaveLength(2);
        expect(list![0].id).toBe("abc-123");
        expect(list![1].id).toBe("def-456");
      } finally {
        dispose();
      }
    });
  });

  // -------------------------------------------------------------------
  // deleteLocalResume (tested through useResumeList.deleteResume)
  // -------------------------------------------------------------------

  it("deleteResume removes the resume and updates the ID list", async () => {
    // Seed localStorage with two resume entries
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["abc-123", "def-456"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "abc-123", JSON.stringify({ dummy: true }));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "def-456", JSON.stringify({ dummy: true }));

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();

        // Wait for the initial resource to load
        await store.refresh();

        // Delete one resume
        await store.deleteResume("abc-123");

        // The localStorage key for that resume should be gone
        expect(mockStorage.getItem(STORAGE_KEY_PREFIX + "abc-123")).toBeNull();

        // The IDs list should only have the remaining entry
        const ids = JSON.parse(mockStorage.getItem(STORAGE_KEY_PREFIX + "_ids")!);
        expect(ids).toEqual(["def-456"]);

        // The resource should have been refetched
        const list = store.resumes();
        expect(list).toBeDefined();
        expect(list).toHaveLength(1);
        expect(list![0].id).toBe("def-456");
      } finally {
        dispose();
      }
    });
  });

  // -------------------------------------------------------------------
  // localResumeExists (tested through useResumeList.checkExists)
  // -------------------------------------------------------------------

  it("checkExists returns true for existing resume in localStorage", async () => {
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["abc-123"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "abc-123", JSON.stringify({ dummy: true }));

    await createRoot(async (dispose) => {
      try {
        const { checkExists } = useResumeList();
        const exists = await checkExists("abc-123");
        expect(exists).toBe(true);
      } finally {
        dispose();
      }
    });
  });

  it("checkExists returns false for non-existing resume", async () => {
    await createRoot(async (dispose) => {
      try {
        const { checkExists } = useResumeList();
        const exists = await checkExists("does-not-exist");
        expect(exists).toBe(false);
      } finally {
        dispose();
      }
    });
  });
});
