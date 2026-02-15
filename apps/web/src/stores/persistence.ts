import { createResource } from "solid-js";
import { toast } from "../components/ui";
import {
  listResumes as listWasmResumes,
  deleteResume as deleteFromWasmStorage,
  resumeExists as wasmResumeExists,
  isWasmReady,
} from "../wasm";

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
    console.error("Failed to parse resume IDs from localStorage");
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

    async checkExists(id: string): Promise<boolean> {
      return resumeExists(id);
    },
  };
}
