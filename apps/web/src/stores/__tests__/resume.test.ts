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
  // Clear all item-based sections programmatically
  for (const key of Object.keys(base.sections)) {
    const section = base.sections[key as keyof typeof base.sections];
    if (
      section &&
      typeof section === "object" &&
      "items" in section &&
      Array.isArray(section.items)
    ) {
      section.items = [];
    }
  }
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

  it("returns false when a visible section has items", () => {
    const resume = createEmptyResumeData();
    resume.sections.education.visible = true;
    resume.sections.education.items = [
      {
        id: "edu-1",
        visible: true,
        institution: "MIT",
        studyType: "B.S.",
        area: "Computer Science",
        score: "",
        date: "2020",
        summary: "",
        url: { label: "", href: "" },
      },
    ];
    expect(isResumeEmpty(resume)).toBe(false);
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

  it("has resume, id, and isDirty properties", () => {
    createRoot((dispose) => {
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
      const { store, createNewResume, addSectionItem, removeSectionItem } = useResumeStore();
      createNewResume("test-id-6");

      // Seed two known items so the test is deterministic
      addSectionItem("skills", {
        id: "skill-alpha",
        visible: true,
        name: "Alpha",
        description: "",
        level: 3,
        keywords: [],
      });
      addSectionItem("skills", {
        id: "skill-beta",
        visible: true,
        name: "Beta",
        description: "",
        level: 4,
        keywords: [],
      });

      const lengthBefore = store.resume!.sections.skills.items.length;
      const alphaIndex = lengthBefore - 2;

      removeSectionItem("skills", alphaIndex);

      expect(store.resume!.sections.skills.items.length).toBe(lengthBefore - 1);
      // "Beta" should now occupy the slot where "Alpha" was
      expect(store.resume!.sections.skills.items[alphaIndex].name).toBe("Beta");
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

// ---------------------------------------------------------------------------
// Section editor parity — add/edit/remove/reorder/visibility for all types
// ---------------------------------------------------------------------------

describe("section editor parity — all section types", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Profiles ---
  describe("profiles", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("profiles-test");

        // Toggle visibility
        const visBefore = store.resume!.sections.profiles.visible;
        toggleSectionVisibility("profiles");
        expect(store.resume!.sections.profiles.visible).toBe(!visBefore);
        toggleSectionVisibility("profiles");
        expect(store.resume!.sections.profiles.visible).toBe(visBefore);

        // Add
        addSectionItem("profiles", {
          id: "p1",
          visible: true,
          network: "GitHub",
          username: "alice",
          icon: "github",
          url: { label: "", href: "https://github.com/alice" },
        });
        addSectionItem("profiles", {
          id: "p2",
          visible: true,
          network: "LinkedIn",
          username: "alice-ln",
          icon: "linkedin",
          url: { label: "", href: "" },
        });
        expect(store.resume!.sections.profiles.items.length).toBe(2);
        expect(store.resume!.sections.profiles.items[0].network).toBe("GitHub");

        // Edit
        updateSectionItem("profiles", 0, { username: "alice-updated" });
        expect(store.resume!.sections.profiles.items[0].username).toBe("alice-updated");

        // Reorder
        reorderSectionItem("profiles", 0, 1);
        expect(store.resume!.sections.profiles.items[0].network).toBe("LinkedIn");
        expect(store.resume!.sections.profiles.items[1].network).toBe("GitHub");

        // Toggle item visibility
        updateSectionItem("profiles", 0, { visible: false });
        expect(store.resume!.sections.profiles.items[0].visible).toBe(false);

        // Remove
        removeSectionItem("profiles", 0);
        expect(store.resume!.sections.profiles.items.length).toBe(1);
        expect(store.resume!.sections.profiles.items[0].network).toBe("GitHub");

        dispose();
      });
    });
  });

  // --- Awards ---
  describe("awards", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("awards-test");

        const initial = store.resume!.sections.awards.visible;
        toggleSectionVisibility("awards");
        expect(store.resume!.sections.awards.visible).toBe(!initial);

        addSectionItem("awards", {
          id: "a1",
          visible: true,
          title: "Best Paper",
          awarder: "IEEE",
          date: "2023",
          summary: "",
          url: { label: "", href: "" },
        });
        addSectionItem("awards", {
          id: "a2",
          visible: true,
          title: "Innovation Award",
          awarder: "ACM",
          date: "2024",
          summary: "",
          url: { label: "", href: "" },
        });
        expect(store.resume!.sections.awards.items.length).toBe(2);

        updateSectionItem("awards", 0, { title: "Best Paper 2023" });
        expect(store.resume!.sections.awards.items[0].title).toBe("Best Paper 2023");

        reorderSectionItem("awards", 0, 1);
        expect(store.resume!.sections.awards.items[0].title).toBe("Innovation Award");

        updateSectionItem("awards", 1, { visible: false });
        expect(store.resume!.sections.awards.items[1].visible).toBe(false);

        removeSectionItem("awards", 0);
        expect(store.resume!.sections.awards.items.length).toBe(1);

        dispose();
      });
    });
  });

  // --- Certifications ---
  describe("certifications", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("certs-test");

        const initial = store.resume!.sections.certifications.visible;
        toggleSectionVisibility("certifications");
        expect(store.resume!.sections.certifications.visible).toBe(!initial);

        addSectionItem("certifications", {
          id: "c1",
          visible: true,
          name: "AWS SA",
          issuer: "Amazon",
          date: "2023",
          summary: "",
          url: { label: "", href: "" },
        });
        addSectionItem("certifications", {
          id: "c2",
          visible: true,
          name: "GCP Engineer",
          issuer: "Google",
          date: "2024",
          summary: "",
          url: { label: "", href: "" },
        });
        expect(store.resume!.sections.certifications.items.length).toBe(2);

        updateSectionItem("certifications", 0, { issuer: "AWS" });
        expect(store.resume!.sections.certifications.items[0].issuer).toBe("AWS");

        reorderSectionItem("certifications", 0, 1);
        expect(store.resume!.sections.certifications.items[0].name).toBe("GCP Engineer");

        removeSectionItem("certifications", 1);
        expect(store.resume!.sections.certifications.items.length).toBe(1);

        dispose();
      });
    });
  });

  // --- Publications ---
  describe("publications", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("pubs-test");

        const initial = store.resume!.sections.publications.visible;
        toggleSectionVisibility("publications");
        expect(store.resume!.sections.publications.visible).toBe(!initial);

        addSectionItem("publications", {
          id: "pub1",
          visible: true,
          name: "ML Paper",
          publisher: "IEEE",
          date: "2023",
          summary: "",
          url: { label: "", href: "" },
        });
        addSectionItem("publications", {
          id: "pub2",
          visible: true,
          name: "Systems Paper",
          publisher: "ACM",
          date: "2024",
          summary: "",
          url: { label: "", href: "" },
        });
        expect(store.resume!.sections.publications.items.length).toBe(2);

        updateSectionItem("publications", 1, { name: "Distributed Systems" });
        expect(store.resume!.sections.publications.items[1].name).toBe("Distributed Systems");

        reorderSectionItem("publications", 1, 0);
        expect(store.resume!.sections.publications.items[0].name).toBe("Distributed Systems");

        removeSectionItem("publications", 0);
        expect(store.resume!.sections.publications.items.length).toBe(1);
        expect(store.resume!.sections.publications.items[0].name).toBe("ML Paper");

        dispose();
      });
    });
  });

  // --- Languages ---
  describe("languages", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("langs-test");

        const initial = store.resume!.sections.languages.visible;
        toggleSectionVisibility("languages");
        expect(store.resume!.sections.languages.visible).toBe(!initial);

        addSectionItem("languages", {
          id: "l1",
          visible: true,
          name: "English",
          description: "Native",
          level: 5,
        });
        addSectionItem("languages", {
          id: "l2",
          visible: true,
          name: "Spanish",
          description: "Intermediate",
          level: 3,
        });
        expect(store.resume!.sections.languages.items.length).toBe(2);

        updateSectionItem("languages", 1, { level: 4, description: "Advanced" });
        expect(store.resume!.sections.languages.items[1].level).toBe(4);
        expect(store.resume!.sections.languages.items[1].description).toBe("Advanced");

        reorderSectionItem("languages", 0, 1);
        expect(store.resume!.sections.languages.items[0].name).toBe("Spanish");

        removeSectionItem("languages", 0);
        expect(store.resume!.sections.languages.items.length).toBe(1);
        expect(store.resume!.sections.languages.items[0].name).toBe("English");

        dispose();
      });
    });
  });

  // --- Interests ---
  describe("interests", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("interests-test");

        const initial = store.resume!.sections.interests.visible;
        toggleSectionVisibility("interests");
        expect(store.resume!.sections.interests.visible).toBe(!initial);

        addSectionItem("interests", {
          id: "i1",
          visible: true,
          name: "Open Source",
          keywords: ["Linux", "Rust"],
        });
        addSectionItem("interests", {
          id: "i2",
          visible: true,
          name: "Music",
          keywords: ["Piano", "Guitar"],
        });
        expect(store.resume!.sections.interests.items.length).toBe(2);

        updateSectionItem("interests", 0, { keywords: ["Linux", "Rust", "WASM"] });
        expect(store.resume!.sections.interests.items[0].keywords).toEqual([
          "Linux",
          "Rust",
          "WASM",
        ]);

        reorderSectionItem("interests", 0, 1);
        expect(store.resume!.sections.interests.items[0].name).toBe("Music");

        removeSectionItem("interests", 1);
        expect(store.resume!.sections.interests.items.length).toBe(1);

        dispose();
      });
    });
  });

  // --- Volunteer ---
  describe("volunteer", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("volunteer-test");

        const initial = store.resume!.sections.volunteer.visible;
        toggleSectionVisibility("volunteer");
        expect(store.resume!.sections.volunteer.visible).toBe(!initial);

        addSectionItem("volunteer", {
          id: "v1",
          visible: true,
          organization: "Red Cross",
          position: "Coordinator",
          location: "NYC",
          date: "2020 - 2022",
          summary: "",
          url: { label: "", href: "" },
        });
        addSectionItem("volunteer", {
          id: "v2",
          visible: true,
          organization: "Habitat",
          position: "Builder",
          location: "LA",
          date: "2023",
          summary: "",
          url: { label: "", href: "" },
        });
        expect(store.resume!.sections.volunteer.items.length).toBe(2);

        updateSectionItem("volunteer", 0, { position: "Lead Coordinator" });
        expect(store.resume!.sections.volunteer.items[0].position).toBe("Lead Coordinator");

        reorderSectionItem("volunteer", 0, 1);
        expect(store.resume!.sections.volunteer.items[0].organization).toBe("Habitat");

        updateSectionItem("volunteer", 1, { visible: false });
        expect(store.resume!.sections.volunteer.items[1].visible).toBe(false);

        removeSectionItem("volunteer", 0);
        expect(store.resume!.sections.volunteer.items.length).toBe(1);

        dispose();
      });
    });
  });

  // --- References ---
  describe("references", () => {
    it("add/edit/remove/reorder/visibility", () => {
      createRoot((dispose) => {
        const {
          store,
          createNewResume,
          addSectionItem,
          updateSectionItem,
          removeSectionItem,
          reorderSectionItem,
          toggleSectionVisibility,
        } = useResumeStore();
        createNewResume("refs-test");

        const initial = store.resume!.sections.references.visible;
        toggleSectionVisibility("references");
        expect(store.resume!.sections.references.visible).toBe(!initial);

        addSectionItem("references", {
          id: "r1",
          visible: true,
          name: "Jane Smith",
          description: "Manager at Acme",
          summary: "Great colleague",
          url: { label: "", href: "" },
        });
        addSectionItem("references", {
          id: "r2",
          visible: true,
          name: "Bob Jones",
          description: "CTO at Startup",
          summary: "",
          url: { label: "", href: "" },
        });
        expect(store.resume!.sections.references.items.length).toBe(2);

        updateSectionItem("references", 0, { description: "Senior Manager at Acme" });
        expect(store.resume!.sections.references.items[0].description).toBe(
          "Senior Manager at Acme",
        );

        reorderSectionItem("references", 0, 1);
        expect(store.resume!.sections.references.items[0].name).toBe("Bob Jones");

        removeSectionItem("references", 0);
        expect(store.resume!.sections.references.items.length).toBe(1);
        expect(store.resume!.sections.references.items[0].name).toBe("Jane Smith");

        dispose();
      });
    });
  });
});
