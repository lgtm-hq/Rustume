import { createStore, produce } from "solid-js/store";
import { batch } from "solid-js";
import { toast } from "../components/ui";
import type {
  ResumeData,
  Basics,
  Sections,
  Metadata,
  Picture,
  Section,
  CustomItem,
  CoverLetterRecipient,
} from "../wasm/types";
import { resumeMapsToObjects } from "../wasm/normalize";
import { generateId } from "../wasm/types";
import {
  createEmptyResume,
  createEmptyPicture,
  saveResume as saveToWasmStorage,
  getResume as getFromWasmStorage,
  ensureWasmReady,
} from "../wasm";
import {
  isCloudAuthenticated,
  isCloudWriteBlockedError,
  isResumeVersionConflictError,
  loadCloudResume,
  saveCloudResume,
  showResumeVersionConflictToast,
} from "./cloudStorage";
import { FIXED_LAYOUT_SECTION_KEYS, isHtmlEmpty } from "../lib/resumeSections";
import { setUndoRecorder, recordUndo } from "./editorUndo";
import { saveSnapshot } from "./versionHistory";
import {
  clearUndoHistory,
  noteResumeChanged,
  pushUndoSnapshot,
  redoResume,
  syncUndoAnchor,
  undoResume,
} from "./undoHistory";

/** Thrown when the requested resume does not exist in storage. */
export class ResumeNotFoundError extends Error {
  constructor(id: string) {
    super(`Resume not found: ${id}`);
    this.name = "ResumeNotFoundError";
  }
}

/** Thrown when stored resume data is corrupted or cannot be deserialized. */
export class ResumeCorruptedError extends Error {
  constructor(id: string, cause?: unknown) {
    super(`Resume data is corrupted: ${id}`);
    this.name = "ResumeCorruptedError";
    this.cause = cause;
  }
}

/**
 * Validates that parsed JSON has the required top-level structure of a resume
 * (`basics`, `sections`, and `metadata` must be non-null objects).
 * Throws `ResumeCorruptedError` if the structure is invalid.
 */
export function validateResumeData(parsed: unknown, id: string): ResumeData {
  const record = parsed as Record<string, unknown>;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof record.basics !== "object" ||
    record.basics === null ||
    typeof record.sections !== "object" ||
    record.sections === null ||
    typeof record.metadata !== "object" ||
    record.metadata === null
  ) {
    throw new ResumeCorruptedError(id);
  }
  return parsed as ResumeData;
}

/** Returns true when an error indicates the resume simply does not exist. */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof ResumeNotFoundError) return true;
  if (error instanceof ResumeCorruptedError) return false;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("not found") || msg.includes("notfound") || msg.includes("404");
  }
  // WASM rejects with plain strings (JsValue::from_str), not Error objects.
  if (typeof error === "string") {
    const msg = error.toLowerCase();
    return msg.includes("not found") || msg.includes("notfound") || msg.includes("404");
  }
  return false;
}

/** Every fixed section id a layout can place, in canonical order. */
const ALL_FIXED_LAYOUT_SECTION_IDS: readonly string[] = [
  "summary",
  "coverLetter",
  ...FIXED_LAYOUT_SECTION_KEYS,
];

const ALL_FIXED_LAYOUT_SECTION_ID_SET = new Set<string>(ALL_FIXED_LAYOUT_SECTION_IDS);

function uniqueLayoutIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Append a fixed section id to page 0's first (main) column when the id is
 * absent from a non-empty layout. An empty layout renders the template's
 * default columns, which already place every fixed section, so it needs no
 * repair. A visible-but-unplaced section would otherwise never render (the
 * sheet and the PDF draw only placed ids).
 */
function placeFixedSectionId(layout: string[][][], sectionId: string): void {
  if (layout.length === 0) return;
  for (const page of layout) {
    for (const column of page) {
      if (column.includes(sectionId)) return;
    }
  }
  const page0 = layout[0];
  if (!page0 || page0.length === 0) {
    // Degenerate but reachable via updateLayout: pages exist, page 0 has no
    // columns. Seed the main column rather than dropping the placement.
    layout[0] = [[sectionId]];
    return;
  }
  page0[0].push(sectionId);
}

function removeLayoutIdsFromLaterPages(layout: string[][][], ids: readonly string[]): void {
  const movedIds = new Set(ids);
  for (let pageIndex = 1; pageIndex < layout.length; pageIndex++) {
    layout[pageIndex] = layout[pageIndex].map((column) => column.filter((id) => !movedIds.has(id)));
  }
}

function materializeCustomLayoutSentinels(layout: string[][][], customIds: string[]): Set<string> {
  const layoutIds = new Set<string>();
  let expandedCustom = false;

  for (let pageIndex = 0; pageIndex < layout.length; pageIndex++) {
    layout[pageIndex] = layout[pageIndex].map((column) => {
      const materialized: string[] = [];
      for (const id of column) {
        const ids = id === "custom" ? (expandedCustom ? [] : customIds) : [id];
        if (id === "custom") {
          expandedCustom = true;
        }
        for (const concreteId of ids) {
          if (layoutIds.has(concreteId)) continue;
          layoutIds.add(concreteId);
          materialized.push(concreteId);
        }
      }
      return materialized;
    });
  }

  return layoutIds;
}

/**
 * Check if a resume is effectively empty (no meaningful content).
 * Used to determine whether to show sample data in preview.
 */
export function isResumeEmpty(resume: ResumeData): boolean {
  // Check if basics has any meaningful content
  const basics = resume.basics;
  const hasBasics =
    basics.name.trim() !== "" || basics.email.trim() !== "" || basics.headline.trim() !== "";

  if (hasBasics) return false;

  // Check if summary has content (accounting for TipTap empty patterns)
  if (resume.sections.summary.visible && !isHtmlEmpty(resume.sections.summary.content)) {
    return false;
  }

  for (const key of FIXED_LAYOUT_SECTION_KEYS) {
    const section = resume.sections[key];
    if (section.visible && section.items.length > 0) {
      return false;
    }
  }

  for (const section of Object.values(resume.sections.custom ?? {})) {
    if (section.visible && section.items.length > 0) {
      return false;
    }
  }

  return true;
}

function ensureCoverLetterSection(resume: ResumeData): void {
  if (!resume.sections.coverLetter) {
    resume.sections.coverLetter = {
      id: "coverLetter",
      name: "Cover Letter",
      visible: false,
      recipient: {
        name: "",
        title: "",
        company: "",
        address: "",
        email: "",
      },
      content: "",
    };
  }
}

function normalizeResumeForStore(resume: ResumeData): ResumeData {
  if (!resume.basics.picture) {
    resume.basics.picture = createEmptyPicture();
  }

  // Backfill effect fields missing from resumes persisted before rotation/border/shadow
  // effects existed. Defaults must match the Rust serde defaults in crates/schema/src/basics.rs.
  const effects: Partial<Picture["effects"]> = resume.basics.picture.effects ?? {};
  resume.basics.picture.effects = {
    hidden: effects.hidden ?? false,
    border: effects.border ?? false,
    grayscale: effects.grayscale ?? false,
    rotation: effects.rotation ?? 0,
    borderColor: effects.borderColor ?? "",
    borderWidth: effects.borderWidth ?? 2,
    shadowColor: effects.shadowColor ?? "#00000040",
    shadowSize: effects.shadowSize ?? 0,
  };

  if (
    typeof resume.sections.custom !== "object" ||
    resume.sections.custom === null ||
    Array.isArray(resume.sections.custom)
  ) {
    resume.sections.custom = {};
  }
  if (!Array.isArray(resume.metadata.layout)) {
    resume.metadata.layout = [];
  }
  ensureCoverLetterSection(resume);

  const customIds = Object.keys(resume.sections.custom);
  if (resume.metadata.layout.length === 0) {
    const shouldSeedEmptyLayout =
      customIds.length > 0 ||
      (resume.sections.coverLetter != null && resume.sections.coverLetter.visible);
    if (!shouldSeedEmptyLayout) return resume;
    ensureCoverLetterSection(resume);
    resume.metadata.layout = [
      [["summary", "coverLetter", ...FIXED_LAYOUT_SECTION_KEYS, ...customIds]],
    ];
    return resume;
  }

  const layoutIds = materializeCustomLayoutSentinels(resume.metadata.layout, customIds);
  const page0 = resume.metadata.layout[0];
  if (!page0 || page0.length === 0) {
    const fixedIds = uniqueLayoutIds(
      resume.metadata.layout.flat(2).filter((id) => ALL_FIXED_LAYOUT_SECTION_ID_SET.has(id)),
    );
    // Fixed ids absent from every page get back-filled here too, so this
    // branch upholds the same invariant as the non-empty page-0 path below.
    const absentFixedIds = ALL_FIXED_LAYOUT_SECTION_IDS.filter((id) => !layoutIds.has(id));
    const page0Ids = uniqueLayoutIds([...fixedIds, ...absentFixedIds, ...customIds]);
    resume.metadata.layout[0] = [page0Ids];
    removeLayoutIdsFromLaterPages(resume.metadata.layout, page0Ids);
    return resume;
  }

  // Back-fill fixed ids missing from a non-empty layout (legacy/pruned
  // layouts saved before a fixed section existed). Hidden sections do not
  // render, so this only guarantees a visibility toggle has somewhere to
  // land. Column 0 is always the main column.
  const missingFixedIds = ALL_FIXED_LAYOUT_SECTION_IDS.filter((id) => !layoutIds.has(id));
  if (missingFixedIds.length > 0) {
    page0[0].push(...missingFixedIds);
  }

  if (customIds.length === 0) return resume;

  const missingCustomIds = customIds.filter((id) => !layoutIds.has(id));
  if (missingCustomIds.length > 0) {
    const normalizedPage0 = resume.metadata.layout[0] ?? [];
    const lastColumn = normalizedPage0.at(-1);
    if (lastColumn) {
      lastColumn.push(...missingCustomIds);
    } else {
      resume.metadata.layout[0] = [missingCustomIds];
    }
  }

  return resume;
}

// Fallback localStorage storage when WASM is not available
const STORAGE_KEY_PREFIX = "rustume:";

function saveToLocalStorage(id: string, data: ResumeData): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(data));
  // Also update the list of resume IDs
  let ids: string[];
  try {
    ids = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + "_ids") || "[]") as string[];
  } catch {
    console.error("Failed to parse resume IDs from localStorage, resetting list");
    toast.warning("Resume ID data was corrupted — it has been reset");
    ids = [];
  }
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(ids));
  }
}

function getFromLocalStorage(id: string): ResumeData {
  const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
  if (!data) throw new ResumeNotFoundError(id);
  try {
    const parsed: unknown = JSON.parse(data);
    return validateResumeData(parsed, id);
  } catch (e) {
    if (e instanceof ResumeCorruptedError) throw e;
    console.error("Failed to parse resume data from localStorage:", id);
    throw new ResumeCorruptedError(id, e);
  }
}

async function saveResume(id: string, data: ResumeData): Promise<void> {
  if (isCloudAuthenticated()) {
    await saveCloudResume(id, data);
    return;
  }
  // Wait for WASM so we don't write to localStorage while IndexedDB is the real store.
  if (await ensureWasmReady()) {
    await saveToWasmStorage(id, data);
    return;
  }
  saveToLocalStorage(id, data);
}

async function getResume(id: string): Promise<ResumeData> {
  if (isCloudAuthenticated()) {
    return loadCloudResume(id);
  }
  if (await ensureWasmReady()) {
    return getFromWasmStorage(id);
  }
  return getFromLocalStorage(id);
}

export type SectionKey = keyof Omit<Sections, "summary" | "coverLetter" | "custom">;
export type LayoutSectionKey = SectionKey | "summary" | "coverLetter" | "custom";
export type CustomSectionKey = `custom:${string}`;

function createCustomSection(name: string): Section<CustomItem> {
  const id = crypto.randomUUID();
  return {
    id,
    name,
    columns: 1,
    separateLinks: false,
    visible: true,
    items: [],
  };
}

export interface ResumeStore {
  resume: ResumeData | null;
  id: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

const [store, setStore] = createStore<ResumeStore>({
  resume: null,
  id: null,
  isDirty: false,
  isSaving: false,
  lastSaved: null,
  error: null,
});

// Auto-save debounce timer
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DELAY = 1000;

async function persistResume() {
  if (!store.resume || !store.id) return;

  setStore("isSaving", true);
  setStore("error", null);

  try {
    const id = store.id;
    const resume = store.resume;
    await saveResume(id, resume);
    if (!isCloudAuthenticated()) {
      void saveSnapshot(id, resume);
    }
    // Keep home-list metadata/timestamps in sync (dynamic import avoids a cycle).
    try {
      const { notifyResumeSaved } = await import("./persistence");
      notifyResumeSaved(id, resume);
    } catch (metaErr) {
      console.error("Failed to update resume list metadata:", metaErr);
    }
    batch(() => {
      setStore("isDirty", false);
      setStore("lastSaved", new Date());
      setStore("isSaving", false);
    });
  } catch (e) {
    if (isResumeVersionConflictError(e) && store.id) {
      showResumeVersionConflictToast(store.id);
      setStore("error", e.message);
      setStore("isSaving", false);
      return;
    }
    if (isCloudWriteBlockedError(e)) {
      setStore("error", "Reload required to sync latest changes");
      setStore("isSaving", false);
      return;
    }
    setStore("error", e instanceof Error ? e.message : "Failed to save");
    setStore("isSaving", false);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistResume, SAVE_DELAY);
}

// Mark as dirty and schedule save
function markDirty() {
  noteResumeChanged(store.resume);
  setStore("isDirty", true);
  scheduleSave();
}

/**
 * Deep-clone `data` and normalize it for the store — the one step every
 * entry point (import, restore, undo, migration) must pass through so the
 * store always owns a plain, invariant-holding tree.
 */
function cloneAndNormalize(data: ResumeData): ResumeData {
  // Map-typed fields must become plain objects BEFORE the JSON clone — a JS
  // `Map` stringifies to `{}`, which is how custom sections were once wiped
  // (old IndexedDB snapshots may still carry Maps; structuredClone kept them).
  resumeMapsToObjects(data);
  return normalizeResumeForStore(JSON.parse(JSON.stringify(data)) as ResumeData);
}

function applyHistoryResume(data: ResumeData): void {
  const clone = cloneAndNormalize(data);
  batch(() => {
    setStore("resume", clone);
    setStore("isDirty", true);
    setStore("error", null);
  });
  scheduleSave();
}

// Wire version-history revert into the in-session undo stack.
setUndoRecorder((previous) => {
  pushUndoSnapshot(previous);
});

// Public API
export function useResumeStore() {
  return {
    store,

    async loadResume(id: string) {
      try {
        const resume = normalizeResumeForStore(await getResume(id));
        batch(() => {
          setStore("resume", resume);
          setStore("id", id);
          setStore("isDirty", false);
          setStore("error", null);
        });
        clearUndoHistory(resume);
      } catch (e) {
        setStore("error", e instanceof Error ? e.message : "Failed to load");
        throw e; // Re-throw so caller can handle (e.g., create new resume)
      }
    },

    createNewResume(id: string) {
      // Normalize even the factory default: the local fallback default's
      // layout places only a subset of the fixed sections, and every other
      // path into the store (load, import, undo) already normalizes.
      const resume = normalizeResumeForStore(createEmptyResume());
      batch(() => {
        setStore("resume", resume);
        setStore("id", id);
        setStore("isDirty", true);
        setStore("error", null);
      });
      clearUndoHistory(resume);
      scheduleSave();
    },

    // Basics updates
    updateBasics<K extends keyof Basics>(field: K, value: Basics[K]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.basics[field] = value;
          }
        }),
      );
      markDirty();
    },

    // Summary update
    updateSummary(content: string) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.sections.summary.content = content;
          }
        }),
      );
      markDirty();
    },

    // Cover letter content
    updateCoverLetter(content: string) {
      setStore(
        produce((s) => {
          if (s.resume) {
            ensureCoverLetterSection(s.resume);
            s.resume.sections.coverLetter.content = content;
          }
        }),
      );
      markDirty();
    },

    // Cover letter recipient fields
    updateCoverLetterRecipient<K extends keyof CoverLetterRecipient>(
      field: K,
      value: CoverLetterRecipient[K],
    ) {
      setStore(
        produce((s) => {
          if (s.resume) {
            ensureCoverLetterSection(s.resume);
            s.resume.sections.coverLetter.recipient[field] = value;
          }
        }),
      );
      markDirty();
    },

    // Section visibility
    toggleSectionVisibility(sectionKey: LayoutSectionKey) {
      setStore(
        produce((s) => {
          if (!s.resume) return;
          if (sectionKey === "custom") {
            const sections = Object.values(s.resume.sections.custom);
            const nextVisible = !sections.some((section) => section.visible);
            for (const section of sections) {
              section.visible = nextVisible;
            }
            return;
          }
          const section = s.resume.sections[sectionKey];
          section.visible = !section.visible;
          // A section toggled visible must also be placed, or the sheet and
          // the PDF silently never draw it. Same write as the flip, so the
          // toggle stays one action and one undo entry.
          if (section.visible) {
            placeFixedSectionId(s.resume.metadata.layout, sectionKey);
          }
        }),
      );
      markDirty();
    },

    /**
     * Rename a fixed section.
     *
     * The custom-section equivalent is `updateCustomSection`; this is the fixed
     * sections' counterpart, which the document editor needs because it edits
     * section headings in place on the sheet.
     */
    updateSectionName(sectionKey: LayoutSectionKey, name: string) {
      setStore(
        produce((s) => {
          if (!s.resume || sectionKey === "custom") return;
          if (sectionKey === "coverLetter") ensureCoverLetterSection(s.resume);
          s.resume.sections[sectionKey].name = name;
        }),
      );
      markDirty();
    },

    // Generic section item operations
    addSectionItem<K extends SectionKey>(sectionKey: K, item: Sections[K]["items"][number]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            (s.resume.sections[sectionKey] as Section<unknown>).items.push(item);
          }
        }),
      );
      markDirty();
    },

    updateSectionItem<K extends SectionKey>(
      sectionKey: K,
      index: number,
      updates: Partial<Sections[K]["items"][number]>,
    ) {
      setStore(
        produce((s) => {
          if (s.resume) {
            const section = s.resume.sections[sectionKey] as unknown as Section<
              Record<string, unknown>
            >;
            if (section.items[index]) {
              Object.assign(section.items[index], updates);
            }
          }
        }),
      );
      markDirty();
    },

    removeSectionItem<K extends SectionKey>(sectionKey: K, index: number) {
      setStore(
        produce((s) => {
          if (s.resume) {
            (s.resume.sections[sectionKey] as Section<unknown>).items.splice(index, 1);
          }
        }),
      );
      markDirty();
    },

    /**
     * Clone the item at `index` — fresh id, same everything else — and insert
     * the copy right after the original, as one action and one undo entry.
     */
    duplicateSectionItem<K extends SectionKey>(sectionKey: K, index: number) {
      const section = store.resume?.sections[sectionKey] as Section<{ id: string }> | undefined;
      if (!section?.items[index]) return;
      setStore(
        produce((s) => {
          if (!s.resume) return;
          const target = s.resume.sections[sectionKey] as Section<{ id: string }>;
          const item = target.items[index];
          if (!item) return;
          const clone = JSON.parse(JSON.stringify(item)) as { id: string };
          clone.id = generateId();
          target.items.splice(index + 1, 0, clone);
        }),
      );
      markDirty();
    },

    reorderSectionItem<K extends SectionKey>(sectionKey: K, fromIndex: number, toIndex: number) {
      setStore(
        produce((s) => {
          if (s.resume) {
            const section = s.resume.sections[sectionKey] as Section<unknown>;
            const [item] = section.items.splice(fromIndex, 1);
            section.items.splice(toIndex, 0, item);
          }
        }),
      );
      markDirty();
    },

    addCustomSection(name: string): string {
      const section = createCustomSection(name);
      setStore(
        produce((s) => {
          if (!s.resume) return;

          s.resume.sections.custom[section.id] = section;
          if (s.resume.metadata.layout.length === 0) {
            ensureCoverLetterSection(s.resume);
            s.resume.metadata.layout = [
              [["summary", "coverLetter", ...FIXED_LAYOUT_SECTION_KEYS, section.id]],
            ];
            return;
          }

          const page = s.resume.metadata.layout[0] ?? [];
          if (!page || page.length === 0) {
            const fixedIds = uniqueLayoutIds(
              s.resume.metadata.layout
                .flat(2)
                .filter((id) => ALL_FIXED_LAYOUT_SECTION_ID_SET.has(id)),
            );
            const page0Ids = uniqueLayoutIds([...fixedIds, section.id]);
            s.resume.metadata.layout[0] = [page0Ids];
            removeLayoutIdsFromLaterPages(s.resume.metadata.layout, page0Ids);
            return;
          }

          page[page.length - 1].push(section.id);
        }),
      );
      markDirty();
      return section.id;
    },

    updateCustomSection(
      sectionId: string,
      updates: Partial<Pick<Section<CustomItem>, "name" | "visible">>,
    ) {
      setStore(
        produce((s) => {
          const section = s.resume?.sections.custom[sectionId];
          if (!section) return;
          Object.assign(section, updates);
        }),
      );
      markDirty();
    },

    removeCustomSection(sectionId: string) {
      setStore(
        produce((s) => {
          if (!s.resume) return;
          delete s.resume.sections.custom[sectionId];
          s.resume.metadata.layout = s.resume.metadata.layout.map((page) =>
            page.map((column) => column.filter((id) => id !== sectionId)),
          );
        }),
      );
      markDirty();
    },

    addCustomSectionItem(sectionId: string, item: CustomItem) {
      const items = store.resume?.sections.custom[sectionId]?.items;
      if (!items) return;
      setStore("resume", "sections", "custom", sectionId, "items", items.length, item);
      markDirty();
    },

    updateCustomSectionItem(sectionId: string, index: number, updates: Partial<CustomItem>) {
      const item = store.resume?.sections.custom[sectionId]?.items[index];
      if (!item) return;
      setStore("resume", "sections", "custom", sectionId, "items", index, updates);
      markDirty();
    },

    removeCustomSectionItem(sectionId: string, index: number) {
      const items = store.resume?.sections.custom[sectionId]?.items;
      if (!items) return;
      setStore(
        "resume",
        "sections",
        "custom",
        sectionId,
        "items",
        items.filter((_, itemIndex) => itemIndex !== index),
      );
      markDirty();
    },

    reorderCustomSectionItem(sectionId: string, fromIndex: number, toIndex: number) {
      const items = store.resume?.sections.custom[sectionId]?.items;
      if (!items) return;
      const nextItems = [...items];
      const [item] = nextItems.splice(fromIndex, 1);
      if (!item) return;
      nextItems.splice(toIndex, 0, item);
      setStore("resume", "sections", "custom", sectionId, "items", nextItems);
      markDirty();
    },

    /** Custom-section counterpart of `duplicateSectionItem`. */
    duplicateCustomSectionItem(sectionId: string, index: number) {
      const items = store.resume?.sections.custom[sectionId]?.items;
      const item = items?.[index];
      if (!items || !item) return;
      const clone = JSON.parse(JSON.stringify(item)) as CustomItem;
      clone.id = generateId();
      const nextItems = [...items];
      nextItems.splice(index + 1, 0, clone);
      setStore("resume", "sections", "custom", sectionId, "items", nextItems);
      markDirty();
    },

    /**
     * Move an item between two custom sections as **one** action — removal and
     * insertion together, so a cross-section drag is a single undo entry.
     * Custom sections only: they are the only sections sharing an item shape.
     */
    moveCustomSectionItem(
      fromSectionId: string,
      fromIndex: number,
      toSectionId: string,
      toIndex: number,
    ) {
      if (fromSectionId === toSectionId) return;
      const fromItems = store.resume?.sections.custom[fromSectionId]?.items;
      const toItems = store.resume?.sections.custom[toSectionId]?.items;
      const item = fromItems?.[fromIndex];
      if (!fromItems || !toItems || !item) return;
      setStore(
        produce((s) => {
          if (!s.resume) return;
          const source = s.resume.sections.custom[fromSectionId];
          const target = s.resume.sections.custom[toSectionId];
          if (!source || !target) return;
          const [moved] = source.items.splice(fromIndex, 1);
          if (!moved) return;
          target.items.splice(Math.max(0, Math.min(toIndex, target.items.length)), 0, moved);
        }),
      );
      markDirty();
    },

    // Metadata updates
    updateMetadata<K extends keyof Metadata>(field: K, value: Metadata[K]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata[field] = value;
          }
        }),
      );
      markDirty();
    },

    updateTemplate(template: string) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata.template = template;
          }
        }),
      );
      markDirty();
    },

    /**
     * Switch templates as **one** action: `metadata.template` and the fresh
     * `metadata.layout` land in a single write, so the switch is a single
     * undo entry — undoing it restores the previous template and its layout
     * together.
     */
    applyTemplate(template: string, layout: string[][][]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata.template = template;
            s.resume.metadata.layout = layout;
          }
        }),
      );
      markDirty();
    },

    updateTheme(theme: Partial<Metadata["theme"]>) {
      setStore(
        produce((s) => {
          if (s.resume) {
            Object.assign(s.resume.metadata.theme, theme);
          }
        }),
      );
      markDirty();
    },

    // Layout updates (pages -> columns -> section IDs)
    updateLayout(layout: string[][][]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata.layout = layout;
          }
        }),
      );
      markDirty();
    },

    /**
     * Replace the resume with its content-format migration (#786) as one write.
     *
     * Behaves like a load-time normalization rather than an edit: the resume
     * is marked dirty so the migrated form persists through the normal
     * autosave path, but the undo anchor realigns to the migrated document —
     * undo must never restore the raw-HTML form the editor cannot display.
     */
    applyContentMigration(migrated: ResumeData) {
      const clone = cloneAndNormalize(migrated);
      batch(() => {
        setStore("resume", clone);
        setStore("isDirty", true);
        setStore("error", null);
      });
      syncUndoAnchor(clone);
      scheduleSave();
    },

    // Import resume data into the currently open resume id.
    importResume(data: ResumeData) {
      // Deep clone so Solid store owns a plain tree (imported objects may be frozen / aliased).
      const clone = cloneAndNormalize(data);
      batch(() => {
        setStore("resume", clone);
        setStore("isDirty", true);
        setStore("error", null);
      });
      scheduleSave();
    },

    /** Import as a brand-new resume (e.g. from the Home screen) and persist under `id`. */
    createFromImport(id: string, data: ResumeData) {
      const clone = cloneAndNormalize(data);
      batch(() => {
        setStore("resume", clone);
        setStore("id", id);
        setStore("isDirty", true);
        setStore("error", null);
      });
      clearUndoHistory(clone);
      scheduleSave();
    },

    /**
     * Restore a prior editor session after a failed createFromImport + forceSave.
     * Cancels any pending autosave so the rolled-back state is not overwritten.
     */
    restoreSession(snapshot: { id: string | null; resume: ResumeData | null; isDirty: boolean }) {
      if (saveTimer) clearTimeout(saveTimer);
      batch(() => {
        setStore("id", snapshot.id);
        setStore("resume", snapshot.resume);
        setStore("isDirty", snapshot.isDirty);
        setStore("error", null);
      });
    },

    /** Replace the current resume with a historical snapshot (local mode revert). */
    revertToSnapshot(data: ResumeData) {
      recordUndo(store.resume);
      const clone = cloneAndNormalize(data);
      batch(() => {
        setStore("resume", clone);
        setStore("isDirty", true);
        setStore("error", null);
      });
      syncUndoAnchor(clone);
      scheduleSave();
    },

    /**
     * Apply a resume already restored on the server (cloud version restore).
     * Does not clear undo history or schedule another save.
     */
    applyRestoredResume(data: ResumeData) {
      const clone = cloneAndNormalize(data);
      batch(() => {
        setStore("resume", clone);
        setStore("isDirty", false);
        setStore("error", null);
      });
      syncUndoAnchor(clone);
    },

    undo() {
      const previous = undoResume(store.resume);
      if (!previous) return false;
      applyHistoryResume(previous);
      return true;
    },

    redo() {
      const next = redoResume(store.resume);
      if (!next) return false;
      applyHistoryResume(next);
      return true;
    },

    // Force save. Returns true when the in-memory resume is no longer dirty.
    async forceSave(): Promise<boolean> {
      if (saveTimer) clearTimeout(saveTimer);
      await persistResume();
      return !store.isDirty;
    },
  };
}

// Singleton for use outside components
export const resumeStore = useResumeStore();
