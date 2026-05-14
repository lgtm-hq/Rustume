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

  it("keeps custom section keys when passed as extra allowed ids", () => {
    const cid = "b4tons2d770gaaa9zl2unwb8";
    const result = normalizeLayout([["summary", cid, "experience"], ["skills"]], [cid]);
    expect(result[0]).toContain(cid);
    expect(result[0]).toContain("summary");
  });

  it("appends missing custom section keys to the last column", () => {
    const cid = "ugcxxsscnvbuhbi5yd5rv8i5";
    const result = normalizeLayout([["summary"], ["skills"]], [cid]);
    expect(result.at(-1)).toContain(cid);
  });

  it("includes custom section keys when normalizing an empty layout", () => {
    const cid = "qi5cmgfnd00p98ndwm53xjwf";
    const result = normalizeLayout([], [cid]);
    expect(result[0]).toContain(cid);
  });

  it("does not include the aggregate custom placeholder as a draggable section", () => {
    const result = normalizeLayout([["summary"], ["skills"]]);
    expect(result.flat()).not.toContain("custom");
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

  it("addCustomSection creates a named section and appends it to page 0", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addCustomSection } = useResumeStore();
      createNewResume("layout-test-custom");

      const id = addCustomSection("API Testing");

      expect(store.resume!.sections.custom[id].name).toBe("API Testing");
      expect(store.resume!.sections.custom[id].visible).toBe(true);
      expect(store.resume!.metadata.layout[0].at(-1)).toContain(id);
      dispose();
    });
  });

  it("importResume appends missing custom section IDs to the persisted layout", () => {
    createRoot((dispose) => {
      const { store, importResume } = useResumeStore();
      const resume = createDefaultResume();
      resume.metadata.layout = [[["summary"], ["skills"]]];
      resume.sections.custom["api-testing"] = {
        id: "api-testing",
        name: "API Testing",
        columns: 1,
        separateLinks: false,
        visible: true,
        items: [],
      };

      importResume(resume);

      expect(store.resume!.metadata.layout[0].at(-1)).toContain("api-testing");
      dispose();
    });
  });

  it("removeCustomSection removes the custom section from metadata layout", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addCustomSection, removeCustomSection } = useResumeStore();
      createNewResume("layout-test-remove-custom");
      const id = addCustomSection("API Testing");

      removeCustomSection(id);

      expect(store.resume!.sections.custom[id]).toBeUndefined();
      expect(store.resume!.metadata.layout.flat(2)).not.toContain(id);
      dispose();
    });
  });

  it("addCustomSectionItem appends an item to a custom section", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addCustomSection, addCustomSectionItem } = useResumeStore();
      createNewResume("layout-test-custom-item");
      const id = addCustomSection("API Testing");

      addCustomSectionItem(id, {
        id: "tooling",
        visible: true,
        name: "Tooling",
        description: "Postman and Playwright",
        date: "",
        location: "",
        summary: "",
        keywords: [],
        url: { label: "", href: "" },
      });

      expect(store.resume!.sections.custom[id].items).toHaveLength(1);
      expect(store.resume!.sections.custom[id].items[0].name).toBe("Tooling");
      dispose();
    });
  });
});
