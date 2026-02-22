import { createRoot } from "solid-js";
import { createDefaultResume } from "../../wasm/defaults";

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

// Stash original so we can restore after all tests.
const _origLocalStorage = globalThis.localStorage;

// Install mock before any module-level code in the SUT runs.
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

afterAll(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: _origLocalStorage,
    writable: true,
    configurable: true,
  });
});

// Mock the WASM module so every code-path falls back to localStorage.
vi.mock("../../wasm", () => ({
  listResumes: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  deleteResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  getResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  saveResume: vi.fn().mockRejectedValue(new Error("WASM not ready")),
  resumeExists: vi.fn().mockResolvedValue(false),
  isWasmReady: () => false,
}));

// Re-import after mock is in place.
import { useResumeList, getMetaMap, getResumeMeta, setResumeMeta } from "../persistence";
import { ResumeNotFoundError, ResumeCorruptedError } from "../resume";

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
    // Pre-populate localStorage with resume IDs and valid resume data
    const resume1 = createDefaultResume();
    resume1.basics.name = "Resume One";
    const resume2 = createDefaultResume();
    resume2.basics.name = "Resume Two";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["abc-123", "def-456"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "abc-123", JSON.stringify(resume1));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "def-456", JSON.stringify(resume2));

    await createRoot(async (dispose) => {
      try {
        const { resumes, refresh } = useResumeList();

        await refresh();
        // Allow Solid's reactivity to settle after async resource update
        await new Promise((r) => setTimeout(r, 0));

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

  // -------------------------------------------------------------------
  // duplicateResume (tested through useResumeList.duplicateResume)
  // -------------------------------------------------------------------

  it("duplicateResume clones resume data under a new ID", async () => {
    const original = createDefaultResume();
    original.basics.name = "Original Name";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["original-id"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "original-id", JSON.stringify(original));

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        const newId = await store.duplicateResume("original-id");

        // New ID should be different from original
        expect(newId).not.toBe("original-id");
        expect(typeof newId).toBe("string");
        expect(newId.length).toBeGreaterThan(0);

        // The cloned resume should exist in localStorage
        const clonedRaw = mockStorage.getItem(STORAGE_KEY_PREFIX + newId);
        expect(clonedRaw).not.toBeNull();

        // The cloned data should match the original
        const cloned = JSON.parse(clonedRaw!);
        expect(cloned.basics.name).toBe("Original Name");

        // The IDs list should now have both
        const ids = JSON.parse(mockStorage.getItem(STORAGE_KEY_PREFIX + "_ids")!);
        expect(ids).toContain("original-id");
        expect(ids).toContain(newId);

        // The resource should have been refetched
        const list = store.resumes();
        expect(list).toBeDefined();
        expect(list).toHaveLength(2);
      } finally {
        dispose();
      }
    });
  });

  it("duplicateResume throws for non-existing resume", async () => {
    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        await expect(store.duplicateResume("nonexistent")).rejects.toThrow("Resume not found");
      } finally {
        dispose();
      }
    });
  });

  it("duplicateResume preserves all sections from original", async () => {
    const original = createDefaultResume();
    original.sections.summary.content = "My custom summary";
    original.metadata.template = "custom-template";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["src-id"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "src-id", JSON.stringify(original));

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        const newId = await store.duplicateResume("src-id");

        const cloned = JSON.parse(mockStorage.getItem(STORAGE_KEY_PREFIX + newId)!);
        expect(cloned.sections.summary.content).toBe("My custom summary");
        expect(cloned.metadata.template).toBe("custom-template");
        expect(cloned.sections.experience.items.length).toBe(
          original.sections.experience.items.length,
        );
      } finally {
        dispose();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Load-failure regression tests (issue #58)
// ---------------------------------------------------------------------------

describe("persistence store - load failure scenarios", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("duplicateResume throws ResumeNotFoundError for missing resumes", async () => {
    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        await expect(store.duplicateResume("nonexistent")).rejects.toThrow(ResumeNotFoundError);
      } finally {
        dispose();
      }
    });
  });

  it("duplicateResume throws ResumeCorruptedError for malformed JSON", async () => {
    // Store invalid JSON under a known ID
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["bad-json"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "bad-json", "{{this is not valid JSON!!");

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        await expect(store.duplicateResume("bad-json")).rejects.toThrow(ResumeCorruptedError);
      } finally {
        dispose();
      }
    });
  });

  it("duplicateResume throws ResumeCorruptedError for structurally invalid data", async () => {
    // Valid JSON but missing required fields (basics, sections, metadata)
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["malformed"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "malformed", JSON.stringify({ name: "incomplete" }));

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        await expect(store.duplicateResume("malformed")).rejects.toThrow(ResumeCorruptedError);
      } finally {
        dispose();
      }
    });
  });

  it("corrupted data does not destroy existing localStorage entries", async () => {
    // Store a valid resume alongside a corrupted one
    const validResume = createDefaultResume();
    validResume.basics.name = "Valid User";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["valid-id", "corrupt-id"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "valid-id", JSON.stringify(validResume));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "corrupt-id", "not json at all");

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        // Attempting to duplicate the corrupted resume should fail
        await expect(store.duplicateResume("corrupt-id")).rejects.toThrow(ResumeCorruptedError);

        // The valid resume should still be intact
        const validRaw = mockStorage.getItem(STORAGE_KEY_PREFIX + "valid-id");
        expect(validRaw).not.toBeNull();
        const parsed = JSON.parse(validRaw!);
        expect(parsed.basics.name).toBe("Valid User");
      } finally {
        dispose();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Resume list metadata persistence (issue #62)
// ---------------------------------------------------------------------------

const META_KEY = STORAGE_KEY_PREFIX + "_meta";

describe("persistence store - metadata helpers", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("getMetaMap returns empty object when no metadata stored", () => {
    expect(getMetaMap()).toEqual({});
  });

  it("setResumeMeta and getResumeMeta round-trip a title", () => {
    setResumeMeta("test-id", "My Resume");
    const meta = getResumeMeta("test-id");
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe("My Resume");
    expect(meta!.updatedAt).toBeTruthy();
    // Should be a valid ISO-8601 string
    expect(new Date(meta!.updatedAt).getTime()).not.toBeNaN();
  });

  it("setResumeMeta accepts a custom updatedAt", () => {
    const date = new Date("2025-06-15T12:00:00Z");
    setResumeMeta("test-id", "Custom Date", date);
    const meta = getResumeMeta("test-id");
    expect(meta!.updatedAt).toBe("2025-06-15T12:00:00.000Z");
  });

  it("setResumeMeta overwrites previous entry", () => {
    setResumeMeta("test-id", "First");
    setResumeMeta("test-id", "Second");
    expect(getResumeMeta("test-id")!.title).toBe("Second");
    // Only one entry in map
    expect(Object.keys(getMetaMap())).toHaveLength(1);
  });

  it("getMetaMap returns empty object for corrupted JSON", () => {
    mockStorage.setItem(META_KEY, "{{not json");
    expect(getMetaMap()).toEqual({});
    // Should also remove the corrupted entry
    expect(mockStorage.getItem(META_KEY)).toBeNull();
  });

  it("getMetaMap returns empty object for non-object JSON (e.g. array)", () => {
    mockStorage.setItem(META_KEY, "[]");
    expect(getMetaMap()).toEqual({});
  });

  it("getResumeMeta returns null for unknown ID", () => {
    expect(getResumeMeta("unknown")).toBeNull();
  });
});

describe("persistence store - metadata in list operations", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("fetchResumeList uses persisted metadata titles", async () => {
    const resume = createDefaultResume();
    resume.basics.name = "Jane Doe";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["r1"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "r1", JSON.stringify(resume));

    // Pre-set metadata
    setResumeMeta("r1", "My Custom Title", new Date("2025-01-01T00:00:00Z"));

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        const list = store.resumes();
        expect(list).toBeDefined();
        expect(list).toHaveLength(1);
        expect(list![0].name).toBe("My Custom Title");
        expect(list![0].updatedAt.toISOString()).toBe("2025-01-01T00:00:00.000Z");
      } finally {
        dispose();
      }
    });
  });

  it("fetchResumeList migrates legacy entries by deriving title from basics.name", async () => {
    const resume = createDefaultResume();
    resume.basics.name = "Legacy User";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["legacy-id"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "legacy-id", JSON.stringify(resume));
    // No metadata entry exists

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();
        await new Promise((r) => setTimeout(r, 0));

        const list = store.resumes();
        expect(list).toBeDefined();
        expect(list).toHaveLength(1);
        expect(list![0].name).toBe("Legacy User");

        // After migration, metadata should be persisted
        const meta = getResumeMeta("legacy-id");
        expect(meta).not.toBeNull();
        expect(meta!.title).toBe("Legacy User");
      } finally {
        dispose();
      }
    });
  });

  it("fetchResumeList falls back to 'Untitled Resume' for empty basics.name", async () => {
    const resume = createDefaultResume();
    resume.basics.name = "";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["empty-name"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "empty-name", JSON.stringify(resume));

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();
        await new Promise((r) => setTimeout(r, 0));

        const list = store.resumes();
        expect(list![0].name).toBe("Untitled Resume");
      } finally {
        dispose();
      }
    });
  });

  it("deleteResume also removes metadata", async () => {
    const resume = createDefaultResume();
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["del-id"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "del-id", JSON.stringify(resume));
    setResumeMeta("del-id", "To Delete");

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        await store.deleteResume("del-id");

        expect(getResumeMeta("del-id")).toBeNull();
      } finally {
        dispose();
      }
    });
  });

  it("duplicateResume copies metadata with '(Copy)' suffix", async () => {
    const resume = createDefaultResume();
    resume.basics.name = "Original";
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["orig"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "orig", JSON.stringify(resume));
    setResumeMeta("orig", "My Resume");

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        const newId = await store.duplicateResume("orig");

        const meta = getResumeMeta(newId);
        expect(meta).not.toBeNull();
        expect(meta!.title).toBe("My Resume (Copy)");
      } finally {
        dispose();
      }
    });
  });

  it("renameResume updates the metadata title", async () => {
    const resume = createDefaultResume();
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["ren-id"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "ren-id", JSON.stringify(resume));
    setResumeMeta("ren-id", "Old Name");

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        await store.renameResume("ren-id", "New Name");

        const meta = getResumeMeta("ren-id");
        expect(meta!.title).toBe("New Name");

        // List should reflect the new name
        const list = store.resumes();
        expect(list![0].name).toBe("New Name");
      } finally {
        dispose();
      }
    });
  });

  it("renameResume trims whitespace and ignores empty strings", async () => {
    const resume = createDefaultResume();
    mockStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(["trim-id"]));
    mockStorage.setItem(STORAGE_KEY_PREFIX + "trim-id", JSON.stringify(resume));
    setResumeMeta("trim-id", "Original");

    await createRoot(async (dispose) => {
      try {
        const store = useResumeList();
        await store.refresh();

        // Empty string should be ignored
        await store.renameResume("trim-id", "   ");
        expect(getResumeMeta("trim-id")!.title).toBe("Original");

        // Whitespace-padded string should be trimmed
        await store.renameResume("trim-id", "  Trimmed  ");
        expect(getResumeMeta("trim-id")!.title).toBe("Trimmed");
      } finally {
        dispose();
      }
    });
  });
});
