/**
 * The structural item actions the document editor's cards call: duplicate,
 * and the single-action cross-section move — each one store action, so each
 * one undo entry.
 */

import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { createDefaultResume } from "../../wasm/defaults";
import { useResumeStore } from "../resume";
import type { CustomItem, Skill } from "../../wasm/types";

vi.mock("../../wasm", () => ({
  createEmptyResume: () => createDefaultResume(),
  saveResume: vi.fn().mockResolvedValue(undefined),
  getResume: vi.fn(),
  isWasmReady: () => false,
  ensureWasmReady: async () => false,
}));

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

  it("does nothing for an index that holds no item", () => {
    createRoot((dispose) => {
      const { store, createNewResume, duplicateSectionItem } = useResumeStore();
      createNewResume("dup-2");
      const before = store.resume!.sections.skills.items.length;

      duplicateSectionItem("skills", 99);

      expect(store.resume!.sections.skills.items.length).toBe(before);
      dispose();
    });
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
});

describe("moveCustomSectionItem", () => {
  it("moves an item between custom sections in one action", () => {
    createRoot((dispose) => {
      const {
        store,
        createNewResume,
        addCustomSection,
        addCustomSectionItem,
        moveCustomSectionItem,
      } = useResumeStore();
      createNewResume("move-1");
      const talks = addCustomSection("Talks");
      const advisory = addCustomSection("Advisory");
      addCustomSectionItem(talks, customItem("t1", "First"));
      addCustomSectionItem(talks, customItem("t2", "Second"));
      addCustomSectionItem(advisory, customItem("a1", "Board"));

      moveCustomSectionItem(talks, 0, advisory, 1);

      expect(store.resume!.sections.custom[talks].items.map((item) => item.id)).toEqual(["t2"]);
      expect(store.resume!.sections.custom[advisory].items.map((item) => item.id)).toEqual([
        "a1",
        "t1",
      ]);
      dispose();
    });
  });

  it("refuses a move onto the same section", () => {
    createRoot((dispose) => {
      const {
        store,
        createNewResume,
        addCustomSection,
        addCustomSectionItem,
        moveCustomSectionItem,
      } = useResumeStore();
      createNewResume("move-2");
      const talks = addCustomSection("Talks");
      addCustomSectionItem(talks, customItem("t1", "First"));
      addCustomSectionItem(talks, customItem("t2", "Second"));

      moveCustomSectionItem(talks, 0, talks, 1);

      expect(store.resume!.sections.custom[talks].items.map((item) => item.id)).toEqual([
        "t1",
        "t2",
      ]);
      dispose();
    });
  });

  it("does nothing when either section or the item is missing", () => {
    createRoot((dispose) => {
      const {
        store,
        createNewResume,
        addCustomSection,
        addCustomSectionItem,
        moveCustomSectionItem,
      } = useResumeStore();
      createNewResume("move-3");
      const talks = addCustomSection("Talks");
      addCustomSectionItem(talks, customItem("t1", "First"));

      moveCustomSectionItem(talks, 5, "nope", 0);
      moveCustomSectionItem("nope", 0, talks, 0);

      expect(store.resume!.sections.custom[talks].items.map((item) => item.id)).toEqual(["t1"]);
      dispose();
    });
  });
});
