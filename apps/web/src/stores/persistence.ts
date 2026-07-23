import { createResource, createEffect, on, onCleanup, onMount } from "solid-js";
import { toast } from "../components/ui";
import {
  listResumes as listWasmResumes,
  deleteResume as deleteFromWasmStorage,
  getResume as getFromWasmStorage,
  saveResume as saveToWasmStorage,
  resumeExists as wasmResumeExists,
  ensureWasmReady,
} from "../wasm";
import { generateId } from "../wasm/types";
import type { ResumeData } from "../wasm/types";
import { ResumeNotFoundError, ResumeCorruptedError, validateResumeData } from "./resume";
import { authStore } from "./auth";
import {
  isCloudAuthenticated,
  isCloudWriteBlockedError,
  isResumeVersionConflictError,
  listCloudResumeSummaries,
  loadCloudResume,
  removeCloudResume,
  renameCloudResume,
  duplicateCloudResume,
  cloudResumeExists,
  saveCloudResume,
  showResumeVersionConflictToast,
} from "./cloudStorage";
import { deleteSnapshotsForResume } from "./versionHistory";

export interface ResumeListItem {
  id: string;
  name: string;
  updatedAt: Date;
  /** First-seen timestamp for sorting; falls back to updatedAt when unknown. */
  createdAt?: Date;
  /** basics.name from the stored resume, when known (for search). */
  basicsName?: string;
  /** basics.headline from the stored resume, when known (for search). */
  headline?: string;
  locked?: boolean;
  tags?: string[];
}

/** Serialized form stored in localStorage under the `_meta` key. */
export interface ResumeMetaEntry {
  title: string;
  updatedAt: string; // ISO-8601
  /** First-seen timestamp; preserved across saves. */
  createdAt?: string;
  /** basics.name snapshot for search; absent on pre-existing entries. */
  basicsName?: string;
  /** basics.headline snapshot for search; absent on pre-existing entries. */
  headline?: string;
  locked?: boolean;
  tags?: string[];
}

/** Searchable fields snapshotted from resume data into metadata. */
export type ResumeSearchMeta = Pick<ResumeMetaEntry, "basicsName" | "headline">;

// LocalStorage fallback
const STORAGE_KEY_PREFIX = "rustume:";
const META_KEY = STORAGE_KEY_PREFIX + "_meta";

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------

/** Check whether a value matches the ResumeMetaEntry shape. */
function isValidMetaEntry(v: unknown): v is ResumeMetaEntry {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj.title !== "string") return false;
  if (typeof obj.updatedAt !== "string") return false;
  if (obj.basicsName !== undefined && typeof obj.basicsName !== "string") return false;
  if (obj.headline !== undefined && typeof obj.headline !== "string") return false;
  return !Number.isNaN(Date.parse(obj.updatedAt));
}

/** Read the entire metadata map from localStorage. */
export function getMetaMap(): Record<string, ResumeMetaEntry> {
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, ResumeMetaEntry> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidMetaEntry(value)) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    console.error("Failed to parse resume metadata from localStorage, resetting");
    localStorage.removeItem(META_KEY);
    return {};
  }
}

/** Persist the full metadata map back to localStorage. Throws on quota errors. */
function setMetaMap(map: Record<string, ResumeMetaEntry>): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch (e) {
    throw new Error("Failed to persist resume metadata: localStorage quota exceeded", { cause: e });
  }
}

/**
 * Upsert metadata for a single resume.
 * Search fields (basicsName/headline) are merged: when `search` is omitted,
 * any previously stored values are preserved.
 */
export function setResumeMeta(
  id: string,
  title: string,
  updatedAt?: Date,
  search?: ResumeSearchMeta,
  extras?: Pick<ResumeMetaEntry, "locked" | "tags">,
): void {
  const map = getMetaMap();
  const existing = map[id];
  const now = (updatedAt ?? new Date()).toISOString();
  map[id] = {
    title,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
    basicsName: search ? search.basicsName : existing?.basicsName,
    headline: search ? search.headline : existing?.headline,
    locked: extras?.locked ?? existing?.locked,
    tags: extras?.tags ?? existing?.tags,
  };
  setMetaMap(map);
}

/** Remove metadata for a single resume. */
function deleteResumeMeta(id: string): void {
  const map = getMetaMap();
  delete map[id];
  setMetaMap(map);
}

/** Get metadata for a single resume, or null if missing. */
export function getResumeMeta(id: string): ResumeMetaEntry | null {
  return getMetaMap()[id] ?? null;
}

/**
 * Derive a display title for a resume.
 * Priority: persisted title > basics.name > fallback placeholder.
 */
export function deriveTitleFromResume(data: ResumeData): string {
  const name = data.basics?.name?.trim();
  if (name) return name;
  return "Untitled Resume";
}

/** Extract searchable basics fields from resume data (trimmed, empty → undefined). */
export function deriveSearchMetaFromResume(data: ResumeData): ResumeSearchMeta {
  const basicsName = data.basics?.name?.trim();
  const headline = data.basics?.headline?.trim();
  return {
    basicsName: basicsName || undefined,
    headline: headline || undefined,
  };
}

function resolveResumeTitle(id: string, data: ResumeData): string {
  const existing = getResumeMeta(id);
  const existingTitle = existing?.title?.trim();
  if (existingTitle) return existingTitle;
  return deriveTitleFromResume(data);
}

function maybeUpdateResumeMeta(id: string, title: string, data?: ResumeData): void {
  const search = data ? deriveSearchMetaFromResume(data) : undefined;
  const extras = data
    ? {
        locked: Boolean(data.metadata?.locked),
        tags: Array.isArray(data.metadata?.tags) ? data.metadata.tags : [],
      }
    : undefined;
  // Always touch updatedAt on save so the home list reflects recent edits.
  try {
    setResumeMeta(id, title, new Date(), search, extras);
  } catch (e) {
    console.error("Failed to update resume metadata:", e);
    toast.warning("Resume saved but metadata could not be updated — storage may be full");
  }
}

/** Update list metadata after a resume save (shared by editor + persistence paths). */
export function notifyResumeSaved(id: string, data: ResumeData): void {
  maybeUpdateResumeMeta(id, resolveResumeTitle(id, data), data);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rustume:resumes-changed"));
  }
}

// ---------------------------------------------------------------------------
// LocalStorage resume CRUD
// ---------------------------------------------------------------------------

function listLocalResumes(): string[] {
  const ids = localStorage.getItem(STORAGE_KEY_PREFIX + "_ids");
  if (!ids) return [];
  try {
    return JSON.parse(ids) as string[];
  } catch {
    console.error("Failed to parse resume IDs from localStorage, resetting list");
    localStorage.removeItem(STORAGE_KEY_PREFIX + "_ids");
    toast.warning("Resume list data was corrupted — it has been reset");
    return [];
  }
}

function deleteLocalResume(id: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  const ids = listLocalResumes().filter((i) => i !== id);
  localStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(ids));
}

function localResumeExists(id: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PREFIX + id) !== null;
}

function getLocalResume(id: string): ResumeData {
  const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
  if (!data) throw new ResumeNotFoundError(id);
  try {
    const parsed: unknown = JSON.parse(data);
    return validateResumeData(parsed, id);
  } catch (e) {
    if (e instanceof ResumeCorruptedError) throw e;
    console.error("Failed to parse resume data from localStorage:", STORAGE_KEY_PREFIX + id);
    throw new ResumeCorruptedError(id, e);
  }
}

/** Save a resume to localStorage. Returns false if the primary write fails. */
function saveLocalResume(id: string, data: ResumeData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save resume to localStorage:", STORAGE_KEY_PREFIX + id, e);
    toast.error("Local storage is full — could not save resume");
    return false;
  }
  let ids: string[];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + "_ids") || "[]");
    ids = Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    console.error("Failed to parse resume IDs from localStorage, resetting list");
    toast.warning("Resume ID data was corrupted — it has been reset");
    ids = [];
  }
  if (!ids.includes(id)) {
    ids.push(id);
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(ids));
    } catch (e) {
      console.error("Failed to update resume ID list in localStorage:", e);
      toast.error("Local storage is full — resume saved but list not updated");
    }
  }

  // Update metadata: keep existing title if set, otherwise derive from data
  const existing = getResumeMeta(id);
  const title = existing?.title ?? deriveTitleFromResume(data);
  try {
    setResumeMeta(id, title, undefined, deriveSearchMetaFromResume(data));
  } catch (e) {
    console.error("Failed to update resume metadata:", e);
    toast.warning("Resume saved but metadata could not be updated — storage may be full");
  }
  return true;
}

// ---------------------------------------------------------------------------
// Unified async API (WASM with localStorage fallback)
// ---------------------------------------------------------------------------

async function listResumes(): Promise<string[]> {
  if (isCloudAuthenticated()) {
    const rows = await listCloudResumeSummaries();
    return rows.map((row) => row.id);
  }
  // Wait for WASM — listing localStorage before init looks "empty" even when
  // resumes already exist in IndexedDB.
  if (await ensureWasmReady()) {
    return listWasmResumes();
  }
  return listLocalResumes();
}

async function deleteResume(id: string): Promise<void> {
  if (isCloudAuthenticated()) {
    await removeCloudResume(id);
  } else if (await ensureWasmReady()) {
    await deleteFromWasmStorage(id);
  } else {
    deleteLocalResume(id);
  }
  deleteResumeMeta(id);
  await deleteSnapshotsForResume(id);
}

async function resumeExists(id: string): Promise<boolean> {
  if (isCloudAuthenticated()) {
    return cloudResumeExists(id);
  }
  if (await ensureWasmReady()) {
    return wasmResumeExists(id);
  }
  return localResumeExists(id);
}

async function getResume(id: string): Promise<ResumeData> {
  if (isCloudAuthenticated()) {
    return loadCloudResume(id);
  }
  if (await ensureWasmReady()) {
    return getFromWasmStorage(id);
  }
  return getLocalResume(id);
}

async function saveResume(id: string, data: ResumeData): Promise<void> {
  if (isCloudAuthenticated()) {
    const title = resolveResumeTitle(id, data);
    try {
      await saveCloudResume(id, data, title);
    } catch (error: unknown) {
      if (isResumeVersionConflictError(error)) {
        showResumeVersionConflictToast(id);
      }
      throw error;
    }
    notifyResumeSaved(id, data);
    return;
  }
  if (await ensureWasmReady()) {
    await saveToWasmStorage(id, data);
    notifyResumeSaved(id, data);
    return;
  }
  if (!saveLocalResume(id, data)) {
    throw new Error("Failed to save resume to local storage");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rustume:resumes-changed"));
  }
}

// ---------------------------------------------------------------------------
// Fetch list with real metadata
// ---------------------------------------------------------------------------

async function fetchResumeList(): Promise<ResumeListItem[]> {
  try {
    if (isCloudAuthenticated()) {
      const rows = await listCloudResumeSummaries();
      // Cloud summaries only carry the title; enrich search fields from the
      // locally cached metadata when available.
      const cachedMeta = getMetaMap();
      return rows.map((row) => ({
        id: row.id,
        name: row.title,
        updatedAt: new Date(row.updated_at),
        createdAt: cachedMeta[row.id]?.createdAt
          ? new Date(cachedMeta[row.id]!.createdAt!)
          : new Date(row.updated_at),
        basicsName: cachedMeta[row.id]?.basicsName,
        headline: cachedMeta[row.id]?.headline,
        locked: cachedMeta[row.id]?.locked,
        tags: cachedMeta[row.id]?.tags,
      }));
    }

    const ids = await listResumes();
    const metaMap = getMetaMap();

    // Identify IDs that need migration (no metadata yet)
    const needsMigration = ids.filter((id) => !metaMap[id]);

    // Migrate missing metadata in parallel
    const migratedMap = new Map<string, ResumeListItem>();
    if (needsMigration.length > 0) {
      const migrationResults = await Promise.allSettled(
        needsMigration.map((id) => getResume(id).then((data) => ({ id, data }))),
      );

      for (let i = 0; i < needsMigration.length; i++) {
        const id = needsMigration[i];
        const result = migrationResults[i];
        let title = "Untitled Resume";
        let search: ResumeSearchMeta = {};
        if (result.status === "fulfilled") {
          title = deriveTitleFromResume(result.value.data);
          search = deriveSearchMetaFromResume(result.value.data);
          // Persist the derived metadata so future loads are instant
          try {
            setResumeMeta(id, title, undefined, search);
          } catch (metaErr) {
            console.error("Failed to persist metadata for resume:", id, metaErr);
          }
        }
        migratedMap.set(id, {
          id,
          name: title,
          updatedAt: new Date(),
          createdAt: new Date(),
          ...search,
        });
      }
    }

    // Map over original ids to preserve ordering
    return ids.map((id) => {
      const migrated = migratedMap.get(id);
      if (migrated) return migrated;
      const meta = metaMap[id];
      return {
        id,
        name: meta.title,
        updatedAt: new Date(meta.updatedAt),
        createdAt: new Date(meta.createdAt ?? meta.updatedAt),
        basicsName: meta.basicsName,
        headline: meta.headline,
        locked: meta.locked,
        tags: meta.tags,
      };
    });
  } catch (e) {
    console.error("Failed to list resumes:", e);
    toast.error("Failed to load resume list");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useResumeList() {
  const [resumes, { refetch }] = createResource(fetchResumeList);

  createEffect(
    on(
      () => [authStore.state.loading, authStore.state.user?.id] as const,
      ([loading, userId], previous) => {
        if (loading || previous === undefined) return;
        const prevUserId = previous[1];
        if (userId !== prevUserId) {
          void refetch();
        }
      },
    ),
  );

  onMount(() => {
    const refresh = () => {
      void refetch();
    };
    window.addEventListener("rustume:resumes-changed", refresh);
    window.addEventListener("rustume:wasm-ready", refresh);
    onCleanup(() => {
      window.removeEventListener("rustume:resumes-changed", refresh);
      window.removeEventListener("rustume:wasm-ready", refresh);
    });
  });

  return {
    resumes,
    loading: () => resumes.loading,
    error: () => resumes.error,

    async refresh() {
      // Solid's createResource ignores refetch() while a load was just scheduled
      // (same-microtask debounce via `scheduled`). Yield so await refresh()
      // always waits for a real load instead of resolving with an empty list.
      await Promise.resolve();
      await refetch();
    },

    async deleteResume(id: string) {
      try {
        await deleteResume(id);
        await refetch();
      } catch (e) {
        console.error("Failed to delete resume:", e);
        toast.error("Failed to delete resume");
        throw e;
      }
    },

    async duplicateResume(id: string): Promise<string> {
      let newId: string | undefined;
      let saveCompleted = false;
      try {
        const original = await getResume(id);
        newId = generateId();

        const originalMeta = getResumeMeta(id);
        const baseName = originalMeta?.title ?? deriveTitleFromResume(original);
        const copyTitle = `${baseName} (Copy)`;

        if (isCloudAuthenticated()) {
          await duplicateCloudResume(id, newId, structuredClone(original), copyTitle);
          saveCompleted = true;
          try {
            setResumeMeta(newId, copyTitle, undefined, deriveSearchMetaFromResume(original));
          } catch (e) {
            console.error("Failed to cache resume metadata locally:", e);
            toast.warning(
              "Resume duplicated but metadata could not be cached — storage may be full",
            );
          }
          await refetch();
          return newId;
        }

        setResumeMeta(newId, copyTitle, undefined, deriveSearchMetaFromResume(original));

        await saveResume(newId, structuredClone(original));
        saveCompleted = true;
        await refetch();
        return newId;
      } catch (e) {
        // Only roll back pre-created metadata if save didn't complete
        if (newId && !saveCompleted) {
          try {
            deleteResumeMeta(newId);
          } catch {
            // Best-effort cleanup
          }
        }
        console.error("Failed to duplicate resume:", e);
        toast.error("Failed to duplicate resume");
        throw e;
      }
    },

    async renameResume(id: string, newTitle: string) {
      try {
        const trimmed = newTitle.trim();
        if (!trimmed) return;
        if (!(await resumeExists(id))) return;

        if (isCloudAuthenticated()) {
          try {
            await renameCloudResume(id, trimmed);
          } catch (error: unknown) {
            if (isResumeVersionConflictError(error)) {
              showResumeVersionConflictToast(id);
            }
            throw error;
          }
          setResumeMeta(id, trimmed);
          await refetch();
          return;
        }

        setResumeMeta(id, trimmed);
        await refetch();
      } catch (e) {
        console.error("Failed to rename resume:", e);
        if (!isResumeVersionConflictError(e) && !isCloudWriteBlockedError(e)) {
          toast.error("Failed to rename resume");
        }
        throw e;
      }
    },

    async checkExists(id: string): Promise<boolean> {
      return resumeExists(id);
    },
  };
}

/** List resume IDs from local storage (WASM or localStorage fallback). */
export async function listStoredResumeIds(): Promise<string[]> {
  if (await ensureWasmReady()) {
    return listWasmResumes();
  }
  return listLocalResumes();
}

/** Load a resume from local storage (WASM or localStorage fallback). */
export async function getStoredResume(id: string): Promise<ResumeData> {
  if (await ensureWasmReady()) {
    return getFromWasmStorage(id);
  }
  return getLocalResume(id);
}

/**
 * Patch lock/tags on a stored resume and refresh list metadata.
 * Works in local and cloud modes via the shared save path.
 */
export async function patchResumeListMeta(
  id: string,
  patch: { locked?: boolean; tags?: string[] },
): Promise<void> {
  const data = await getResume(id);
  if (patch.locked !== undefined) {
    data.metadata.locked = patch.locked;
  }
  if (patch.tags !== undefined) {
    data.metadata.tags = patch.tags;
  }
  await saveResume(id, data);
  notifyResumeSaved(id, data);
}
