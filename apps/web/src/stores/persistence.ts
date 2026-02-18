import { createResource } from "solid-js";
import { toast } from "../components/ui";
import {
  listResumes as listWasmResumes,
  deleteResume as deleteFromWasmStorage,
  getResume as getFromWasmStorage,
  saveResume as saveToWasmStorage,
  resumeExists as wasmResumeExists,
  isWasmReady,
} from "../wasm";
import { generateId } from "../wasm/types";
import type { ResumeData } from "../wasm/types";
import { ResumeNotFoundError, ResumeCorruptedError, validateResumeData } from "./resume";

export interface ResumeListItem {
  id: string;
  name: string;
  updatedAt: Date;
}

// LocalStorage fallback
const STORAGE_KEY_PREFIX = "rustume:";

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

function saveLocalResume(id: string, data: ResumeData): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save resume to localStorage:", STORAGE_KEY_PREFIX + id, e);
    toast.error("Local storage is full — could not save resume");
    return;
  }
  let ids: string[] = [];
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
}

async function listResumes(): Promise<string[]> {
  if (isWasmReady()) {
    return listWasmResumes();
  }
  return listLocalResumes();
}

async function deleteResume(id: string): Promise<void> {
  if (isWasmReady()) {
    return deleteFromWasmStorage(id);
  }
  deleteLocalResume(id);
}

async function resumeExists(id: string): Promise<boolean> {
  if (isWasmReady()) {
    return wasmResumeExists(id);
  }
  return localResumeExists(id);
}

async function getResume(id: string): Promise<ResumeData> {
  if (isWasmReady()) {
    return getFromWasmStorage(id);
  }
  return getLocalResume(id);
}

async function saveResume(id: string, data: ResumeData): Promise<void> {
  if (isWasmReady()) {
    return saveToWasmStorage(id, data);
  }
  saveLocalResume(id, data);
}

async function fetchResumeList(): Promise<ResumeListItem[]> {
  try {
    const ids = await listResumes();
    // For now, just return IDs - in a full implementation,
    // we'd store metadata separately or fetch each resume
    return ids.map((id) => ({
      id,
      name: `Resume ${id.slice(0, 8)}`,
      updatedAt: new Date(),
    }));
  } catch (e) {
    console.error("Failed to list resumes:", e);
    toast.error("Failed to load resume list");
    return [];
  }
}

export function useResumeList() {
  const [resumes, { refetch }] = createResource(fetchResumeList);

  return {
    resumes,
    loading: () => resumes.loading,
    error: () => resumes.error,

    async refresh() {
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
      try {
        const original = await getResume(id);
        const newId = generateId();
        await saveResume(newId, structuredClone(original));
        await refetch();
        return newId;
      } catch (e) {
        console.error("Failed to duplicate resume:", e);
        toast.error("Failed to duplicate resume");
        throw e;
      }
    },

    async checkExists(id: string): Promise<boolean> {
      return resumeExists(id);
    },
  };
}
