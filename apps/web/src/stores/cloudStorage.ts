import {
  createCloudResume,
  deleteCloudResume,
  getCloudResume,
  listCloudResumes,
  ResumeVersionConflictError,
  updateCloudResume,
  upsertCloudResume,
  type CloudResumeSummary,
} from "../api/resumes";
import { ApiError } from "../api/client";
import { toast } from "../components/ui";
import { authStore } from "./auth";
import { deriveTitleFromResume } from "./persistence";
import { validateResumeData } from "./resume";
import type { ResumeData } from "../wasm/types";
import { ResumeNotFoundError } from "./resume";

const resumeVersions = new Map<string, number>();

/** True when cloud mode is enabled and the user has an active session. */
export function isCloudAuthenticated(): boolean {
  const { loading, cloudEnabled, user } = authStore.state;
  return !loading && cloudEnabled && user !== null;
}

export function getCloudResumeVersion(id: string): number | undefined {
  return resumeVersions.get(id);
}

export function setCloudResumeVersion(id: string, version: number): void {
  resumeVersions.set(id, version);
}

export function clearCloudResumeVersion(id: string): void {
  resumeVersions.delete(id);
}

export function isResumeVersionConflictError(error: unknown): error is ResumeVersionConflictError {
  return error instanceof ResumeVersionConflictError;
}

export function showResumeVersionConflictToast(id: string, currentVersion: number): void {
  setCloudResumeVersion(id, currentVersion);
  toast.warning("Resume was updated elsewhere. Reload to see latest changes.", "Conflict", {
    label: "Reload",
    onClick: () => window.location.reload(),
  });
}

export async function listCloudResumeSummaries(): Promise<CloudResumeSummary[]> {
  return listCloudResumes();
}

export async function loadCloudResume(id: string): Promise<ResumeData> {
  try {
    const row = await getCloudResume(id);
    setCloudResumeVersion(id, row.version);
    return validateResumeData(row.data, id);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      throw new ResumeNotFoundError(id);
    }
    throw error;
  }
}

export async function saveCloudResume(id: string, data: ResumeData, title?: string): Promise<void> {
  const resolvedTitle = title ?? deriveTitleFromResume(data);
  const row = await upsertCloudResume(id, data, resolvedTitle, getCloudResumeVersion(id));
  setCloudResumeVersion(id, row.version);
}

export async function createCloudResumeWithId(
  id: string,
  data: ResumeData,
  title?: string,
): Promise<void> {
  const row = await createCloudResume({
    id,
    title: title ?? deriveTitleFromResume(data),
    data,
  });
  setCloudResumeVersion(id, row.version);
}

export async function removeCloudResume(id: string): Promise<void> {
  await deleteCloudResume(id);
  clearCloudResumeVersion(id);
}

export async function renameCloudResume(id: string, title: string): Promise<void> {
  const row = await updateCloudResume(id, {
    title,
    version: getCloudResumeVersion(id),
  });
  setCloudResumeVersion(id, row.version);
}

export async function duplicateCloudResume(
  _sourceId: string,
  newId: string,
  data: ResumeData,
  title: string,
): Promise<void> {
  const row = await createCloudResume({ id: newId, title, data });
  setCloudResumeVersion(newId, row.version);
}

export async function cloudResumeExists(id: string): Promise<boolean> {
  try {
    const row = await getCloudResume(id);
    setCloudResumeVersion(id, row.version);
    return true;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      return false;
    }
    throw error;
  }
}
