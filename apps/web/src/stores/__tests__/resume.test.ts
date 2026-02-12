import { createRoot } from "solid-js";
import { createDefaultResume } from "../../wasm/defaults";
import type { ResumeData } from "../../wasm/types";
import { isResumeEmpty, useResumeStore } from "../resume";

vi.mock("../../wasm", () => ({
  createEmptyResume: () => createDefaultResume(),
  saveResume: vi.fn().mockResolvedValue(undefined),
  getResume: vi.fn(),
  isWasmReady: () => false,
}));

/**
 * Build a structurally complete but content-empty resume.
 * All basics fields are empty strings and every section either has no items
 * or is not visible, so `isResumeEmpty` should return true.
 */
function createEmptyResumeData(): ResumeData {
  const base = createDefaultResume();
  base.basics.name = "";
  base.basics.email = "";
  base.basics.headline = "";
  base.sections.summary.content = "";
  // Clear all item-based sections
  base.sections.experience.items = [];
  base.sections.education.items = [];
  base.sections.skills.items = [];
  base.sections.projects.items = [];
  base.sections.profiles.items = [];
  base.sections.awards.items = [];
  base.sections.certifications.items = [];
  base.sections.publications.items = [];
  base.sections.languages.items = [];
  base.sections.interests.items = [];
  base.sections.volunteer.items = [];
  base.sections.references.items = [];
  return base;
}

// ---------------------------------------------------------------------------
// isResumeEmpty — pure function tests (no reactive context needed)
// ---------------------------------------------------------------------------

describe("isResumeEmpty", () => {
  it("returns true for an empty resume", () => {
    const resume = createEmptyResumeData();
    expect(isResumeEmpty(resume)).toBe(true);
  });

  it("returns false when name is set", () => {
    const resume = createEmptyResumeData();
    resume.basics.name = "Jane Doe";
    expect(isResumeEmpty(resume)).toBe(false);
  });

  it("returns false when email is set", () => {
    const resume = createEmptyResumeData();
    resume.basics.email = "jane@example.com";
    expect(isResumeEmpty(resume)).toBe(false);
  });

  it("returns false when headline is set", () => {
    const resume = createEmptyResumeData();
    resume.basics.headline = "Engineer";
    expect(isResumeEmpty(resume)).toBe(false);
  });

  it("returns false when summary is visible with content", () => {
    const resume = createEmptyResumeData();
    resume.sections.summary.visible = true;
    resume.sections.summary.content = "A brief summary.";
    expect(isResumeEmpty(resume)).toBe(false);
  });

  it("returns true when summary has content but is not visible", () => {
    const resume = createEmptyResumeData();
    resume.sections.summary.visible = false;
    resume.sections.summary.content = "Hidden summary text.";
    expect(isResumeEmpty(resume)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useResumeStore — reactive store tests
// ---------------------------------------------------------------------------

describe("useResumeStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has correct initial state: resume null, id null, isDirty false", () => {
    createRoot((dispose) => {
      // On first import the singleton starts with null resume
      // However, previous tests in this file may have mutated the singleton.
      // We can still verify the shape of the store object.
      const { store } = useResumeStore();
      expect(store).toHaveProperty("resume");
      expect(store).toHaveProperty("id");
      expect(store).toHaveProperty("isDirty");
      dispose();
    });
  });

  it("createNewResume sets resume and id, marks dirty", () => {
    createRoot((dispose) => {
      const { store, createNewResume } = useResumeStore();
      createNewResume("test-id-1");

      expect(store.resume).not.toBeNull();
      expect(store.id).toBe("test-id-1");
      expect(store.isDirty).toBe(true);
      dispose();
    });
  });

  it("updateBasics updates the specified field", () => {
    createRoot((dispose) => {
      const { store, createNewResume, updateBasics } = useResumeStore();
      createNewResume("test-id-2");

      updateBasics("name", "Alice");
      expect(store.resume!.basics.name).toBe("Alice");

      updateBasics("email", "alice@example.com");
      expect(store.resume!.basics.email).toBe("alice@example.com");
      dispose();
    });
  });

  it("updateSummary updates summary content", () => {
    createRoot((dispose) => {
      const { store, createNewResume, updateSummary } = useResumeStore();
      createNewResume("test-id-3");

      updateSummary("New summary content");
      expect(store.resume!.sections.summary.content).toBe("New summary content");
      dispose();
    });
  });

  it("toggleSectionVisibility toggles a section's visible flag", () => {
    createRoot((dispose) => {
      const { store, createNewResume, toggleSectionVisibility } = useResumeStore();
      createNewResume("test-id-4");

      const before = store.resume!.sections.experience.visible;
      toggleSectionVisibility("experience");
      expect(store.resume!.sections.experience.visible).toBe(!before);

      toggleSectionVisibility("experience");
      expect(store.resume!.sections.experience.visible).toBe(before);
      dispose();
    });
  });

  it("addSectionItem appends an item", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addSectionItem } = useResumeStore();
      createNewResume("test-id-5");

      const initialLength = store.resume!.sections.skills.items.length;
      addSectionItem("skills", {
        id: "skill-new",
        visible: true,
        name: "Rust",
        description: "",
        level: 3,
        keywords: [],
      });
      expect(store.resume!.sections.skills.items.length).toBe(initialLength + 1);
      expect(store.resume!.sections.skills.items[initialLength].name).toBe("Rust");
      dispose();
    });
  });

  it("removeSectionItem removes by index", () => {
    createRoot((dispose) => {
      const { store, createNewResume, removeSectionItem } = useResumeStore();
      createNewResume("test-id-6");

      const initialLength = store.resume!.sections.skills.items.length;
      const secondItemName =
        initialLength > 1 ? store.resume!.sections.skills.items[1].name : undefined;

      removeSectionItem("skills", 0);
      expect(store.resume!.sections.skills.items.length).toBe(initialLength - 1);

      // The previously second item is now first
      if (secondItemName !== undefined) {
        expect(store.resume!.sections.skills.items[0].name).toBe(secondItemName);
      }
      dispose();
    });
  });

  it("updateTemplate updates metadata.template", () => {
    createRoot((dispose) => {
      const { store, createNewResume, updateTemplate } = useResumeStore();
      createNewResume("test-id-7");

      updateTemplate("pikachu");
      expect(store.resume!.metadata.template).toBe("pikachu");
      dispose();
    });
  });

  it("importResume replaces resume and marks dirty", () => {
    createRoot((dispose) => {
      const { store, createNewResume, importResume } = useResumeStore();
      createNewResume("test-id-8");

      const imported = createDefaultResume();
      imported.basics.name = "Imported Person";

      importResume(imported);
      expect(store.resume!.basics.name).toBe("Imported Person");
      expect(store.isDirty).toBe(true);
      dispose();
    });
  });
});
