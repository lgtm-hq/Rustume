import { createRoot } from "solid-js";
import { createDefaultResume } from "../../../wasm/defaults";
import { useResumeStore } from "../../../stores/resume";
import { normalizeLayout, ALL_SECTION_IDS } from "../LayoutEditor";

vi.mock("../../../wasm", () => ({
  createEmptyResume: () => createDefaultResume(),
  saveResume: vi.fn().mockResolvedValue(undefined),
  getResume: vi.fn(),
  isWasmReady: () => false,
}));

// ---------------------------------------------------------------------------
// normalizeLayout — pure function tests
// ---------------------------------------------------------------------------

describe("normalizeLayout", () => {
  it("returns one column with all section IDs when given an empty array", () => {
    const result = normalizeLayout([]);
    expect(result.length).toBe(1);
    expect([...result[0]].sort()).toEqual([...ALL_SECTION_IDS].sort());
  });

  it("returns all section IDs when given an empty column", () => {
    const result = normalizeLayout([[]]);
    const flat = result.flat();
    expect(flat.sort()).toEqual([...ALL_SECTION_IDS].sort());
  });

  it("distributes sections across two columns", () => {
    const col1 = ["summary", "experience", "education"];
    const col2 = ["skills", "projects"];
    const result = normalizeLayout([col1, col2]);

    // First two columns should contain their assigned sections
    expect(result[0]).toEqual(col1);
    expect(result[1]).toContain("skills");
    expect(result[1]).toContain("projects");

    // All missing sections should be appended to column 2
    const allInResult = result.flat();
    for (const id of ALL_SECTION_IDS) {
      expect(allInResult).toContain(id);
    }
  });

  it("removes duplicate section IDs", () => {
    const result = normalizeLayout([
      ["summary", "summary", "experience"],
      ["skills", "summary"],
    ]);
    const flat = result.flat();
    const summaryCount = flat.filter((id) => id === "summary").length;
    expect(summaryCount).toBe(1);
  });

  it("removes unknown section IDs", () => {
    const result = normalizeLayout([["summary", "unknown_section", "experience"]]);
    const flat = result.flat();
    expect(flat).not.toContain("unknown_section");
    expect(flat).toContain("summary");
    expect(flat).toContain("experience");
  });

  it("handles three columns", () => {
    const result = normalizeLayout([["summary"], ["skills"], ["experience"]]);
    const flat = result.flat();
    expect(flat.sort()).toEqual([...ALL_SECTION_IDS].sort());
    expect(result[0]).toContain("summary");
    expect(result[1]).toContain("skills");
    expect(result[2]).toContain("experience");
  });
});

// ---------------------------------------------------------------------------
// updateLayout store integration tests
// ---------------------------------------------------------------------------

describe("updateLayout store integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updateLayout updates metadata.layout", () => {
    createRoot((dispose) => {
      const { store, createNewResume, updateLayout } = useResumeStore();
      createNewResume("layout-test-1");

      const newLayout: string[][][] = [
        [
          ["summary", "experience"],
          ["skills", "education"],
        ],
      ];

      updateLayout(newLayout);
      expect(store.resume!.metadata.layout).toEqual(newLayout);
      dispose();
    });
  });

  it("updateLayout marks store as dirty", async () => {
    await createRoot(async (dispose) => {
      const { store, createNewResume, updateLayout, forceSave } = useResumeStore();
      createNewResume("layout-test-2");

      // Force save to clear dirty state
      await forceSave();
      vi.advanceTimersByTime(2000);

      updateLayout([[["summary"], ["skills"]]]);

      expect(store.isDirty).toBe(true);
      dispose();
    });
  });

  it("preserves other pages when updating page 0", () => {
    createRoot((dispose) => {
      const { store, createNewResume, updateLayout } = useResumeStore();
      createNewResume("layout-test-3");

      // Simulate multi-page layout
      const multiPageLayout: string[][][] = [
        [["summary", "experience"], ["skills"]],
        [["education"], ["projects"]],
      ];

      updateLayout(multiPageLayout);
      expect(store.resume!.metadata.layout.length).toBe(2);
      expect(store.resume!.metadata.layout[1]).toEqual([["education"], ["projects"]]);
      dispose();
    });
  });
});
