/**
 * The structural store actions the document editor's cards call — duplicate,
 * remove with page-break marker cleanup, template application, and combined
 * pagination writes. Each is one store action, so each is one undo entry.
 */

import { createRoot } from "solid-js";
import { describe, expect, it, vi, type Mock } from "vitest";
import { createDefaultResume } from "../../wasm/defaults";
import { useResumeStore } from "../resume";
import type { CustomItem, Experience, Skill } from "../../wasm/types";

vi.mock("../../wasm", () => ({
  createEmptyResume: () => createDefaultResume(),
  saveResume: vi.fn().mockResolvedValue(undefined),
  getResume: vi.fn(),
  isWasmReady: () => false,
  ensureWasmReady: async () => false,
}));

function experienceItem(id: string, company: string): Experience {
  return {
    id,
    visible: true,
    company,
    position: "Engineer",
    location: "",
    date: "",
    summary: "",
    url: { label: "", href: "" },
    keywords: [],
    customFields: [],
  };
}

function skill(id: string, name: string): Skill {
  return { id, visible: true, name, description: "", level: 3, keywords: ["k"] };
}

function customItem(id: string, name: string): CustomItem {
  return {
    id,
    visible: true,
    name,
    description: "",
    date: "",
    location: "",
    summary: "",
    keywords: [],
    url: { label: "", href: "" },
  };
}

describe("duplicateSectionItem", () => {
  it("inserts a copy with a distinct id right after the original", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addSectionItem, duplicateSectionItem } = useResumeStore();
      createNewResume("dup-1");
      addSectionItem("skills", skill("skill-a", "Alpha"));
      addSectionItem("skills", skill("skill-b", "Beta"));
      const base = store.resume!.sections.skills.items.length - 2;

      duplicateSectionItem("skills", base);

      const items = store.resume!.sections.skills.items;
      expect(items[base].name).toBe("Alpha");
      expect(items[base + 1].name).toBe("Alpha");
      expect(items[base + 1].id).not.toBe(items[base].id);
      expect(items[base + 1].id).not.toBe("");
      // The copy owns its own arrays — editing one must not edit the other.
      expect(items[base + 1].keywords).not.toBe(items[base].keywords);
      expect(items[base + 2].name).toBe("Beta");
      dispose();
    });
  });

  it("does nothing for an index that holds no item", async () => {
    const { saveResume } = await import("../../wasm");
    vi.useFakeTimers();
    try {
      createRoot((dispose) => {
        const { store, createNewResume, duplicateSectionItem } = useResumeStore();
        createNewResume("dup-2");
        // Drain the setup's own scheduled save so the baseline below measures
        // only what the no-op adds.
        vi.advanceTimersByTime(1500);
        const before = store.resume!.sections.skills.items.length;

        const dirtyBefore = store.isDirty;
        const savesBefore = (saveResume as Mock).mock.calls.length;
        duplicateSectionItem("skills", 99);

        expect(store.resume!.sections.skills.items.length).toBe(before);
        // A no-op must not record a change, dirty the store, or schedule a
        // save — even after the save debounce would have fired.
        expect(store.isDirty).toBe(dirtyBefore);
        vi.advanceTimersByTime(1500);
        expect((saveResume as Mock).mock.calls.length).toBe(savesBefore);
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("duplicateCustomSectionItem", () => {
  it("inserts a copy with a distinct id right after the original", () => {
    createRoot((dispose) => {
      const {
        store,
        createNewResume,
        addCustomSection,
        addCustomSectionItem,
        duplicateCustomSectionItem,
      } = useResumeStore();
      createNewResume("dup-3");
      const sectionId = addCustomSection("Talks");
      addCustomSectionItem(sectionId, customItem("t1", "First"));
      addCustomSectionItem(sectionId, customItem("t2", "Second"));

      duplicateCustomSectionItem(sectionId, 0);

      const items = store.resume!.sections.custom[sectionId].items;
      expect(items.map((item) => item.name)).toEqual(["First", "First", "Second"]);
      expect(items[1].id).not.toBe(items[0].id);
      dispose();
    });
  });

  it("does nothing for an index that holds no item", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addCustomSection, duplicateCustomSectionItem } =
        useResumeStore();
      createNewResume("dup-4");
      const sectionId = addCustomSection("Talks");

      duplicateCustomSectionItem(sectionId, 99);

      expect(store.resume!.sections.custom[sectionId].items.length).toBe(0);
      dispose();
    });
  });
});

describe("applyTemplate", () => {
  it("lands template and layout in one write", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addCustomSection, applyTemplate } = useResumeStore();
      createNewResume("tpl-1");
      const sectionId = addCustomSection("Talks");

      applyTemplate("aurora", [[["summary", "experience"], [sectionId]]]);

      expect(store.resume!.metadata.template).toBe("aurora");
      expect(store.resume!.metadata.layout).toEqual([[["summary", "experience"], [sectionId]]]);
      dispose();
    });
  });

  it("is a single undo entry: undoing restores template and layout together", () => {
    vi.useFakeTimers();
    try {
      createRoot((dispose) => {
        const { store, createNewResume, applyTemplate, undo } = useResumeStore();
        createNewResume("tpl-2");
        // Settle the undo debounce so the switch opens its own edit burst.
        vi.advanceTimersByTime(600);
        const templateBefore = store.resume!.metadata.template;
        const layoutBefore = JSON.parse(
          JSON.stringify(store.resume!.metadata.layout),
        ) as string[][][];

        applyTemplate("aurora", [[["summary"], []]]);
        vi.advanceTimersByTime(600);

        expect(undo()).toBe(true);
        expect(store.resume!.metadata.template).toBe(templateBefore);
        expect(store.resume!.metadata.layout).toEqual(layoutBefore);
        // One entry, not two: a second undo has nothing of this switch left.
        expect(undo()).toBe(false);
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("removeSectionItem", () => {
  it("cleans the removed item's page-break marker in the same write (#796)", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addSectionItem, updateMetadata, removeSectionItem } =
        useResumeStore();
      createNewResume("break-1");
      addSectionItem("experience", experienceItem("exp-a", "Alpha Corp"));
      addSectionItem("experience", experienceItem("exp-b", "Beta Corp"));
      const base = store.resume!.sections.experience.items.length - 2;
      updateMetadata("itemBreaks", { experience: ["exp-b"], education: ["edu-x"] });

      removeSectionItem("experience", base + 1);

      // Only the removed item's marker goes; other sections keep theirs.
      expect(store.resume!.metadata.itemBreaks).toEqual({ education: ["edu-x"] });
      dispose();
    });
  });

  it("leaves itemBreaks untouched when the removed item carried no marker", () => {
    createRoot((dispose) => {
      const { store, createNewResume, addSectionItem, updateMetadata, removeSectionItem } =
        useResumeStore();
      createNewResume("break-2");
      addSectionItem("skills", skill("skill-a", "Alpha"));
      updateMetadata("itemBreaks", { experience: ["exp-x"] });

      removeSectionItem("skills", store.resume!.sections.skills.items.length - 1);

      expect(store.resume!.metadata.itemBreaks).toEqual({ experience: ["exp-x"] });
      dispose();
    });
  });
});

describe("updatePagination", () => {
  it("writes layout and itemBreaks together as one undo entry", () => {
    vi.useFakeTimers();
    try {
      createRoot((dispose) => {
        const { store, createNewResume, updateMetadata, updatePagination, undo } = useResumeStore();
        createNewResume("pagination-1");
        updateMetadata("itemBreaks", { experience: ["exp-x"] });
        vi.advanceTimersByTime(600);
        const layoutBefore = JSON.parse(
          JSON.stringify(store.resume!.metadata.layout),
        ) as string[][][];

        updatePagination([[["summary"], []]], {});
        vi.advanceTimersByTime(600);

        expect(store.resume!.metadata.layout).toEqual([[["summary"], []]]);
        expect(store.resume!.metadata.itemBreaks).toEqual({});

        // One undo restores both halves at once.
        expect(undo()).toBe(true);
        expect(store.resume!.metadata.layout).toEqual(layoutBefore);
        expect(store.resume!.metadata.itemBreaks).toEqual({ experience: ["exp-x"] });
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
