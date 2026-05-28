import {
  createCloudResume,
  deleteCloudResume,
  getCloudResume,
  listCloudResumes,
  updateCloudResume,
  upsertCloudResume,
  type CloudResumeSummary,
} from "../api/resumes";
import { ApiError } from "../api/client";
import { authStore } from "./auth";
import { deriveTitleFromResume } from "./persistence";
import { validateResumeData } from "./resume";
import type { ResumeData } from "../wasm/types";
import { ResumeNotFoundError } from "./resume";

/** True when cloud mode is enabled and the user has an active session. */
export function isCloudAuthenticated(): boolean {
  const { loading, cloudEnabled, user } = authStore.state;
  return !loading && cloudEnabled && user !== null;
}

export async function listCloudResumeSummaries(): Promise<CloudResumeSummary[]> {
  return listCloudResumes();
}

export async function loadCloudResume(id: string): Promise<ResumeData> {
  try {
    const row = await getCloudResume(id);
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
  await upsertCloudResume(id, data, resolvedTitle);
}

export async function createCloudResumeWithId(
  id: string,
  data: ResumeData,
  title?: string,
): Promise<void> {
  await createCloudResume({
    id,
    title: title ?? deriveTitleFromResume(data),
    data,
  });
}

export async function removeCloudResume(id: string): Promise<void> {
  await deleteCloudResume(id);
}

export async function renameCloudResume(id: string, title: string): Promise<void> {
  await updateCloudResume(id, { title });
}

export async function duplicateCloudResume(
  _sourceId: string,
  newId: string,
  data: ResumeData,
  title: string,
): Promise<void> {
  await createCloudResume({ id: newId, title, data });
}

export async function cloudResumeExists(id: string): Promise<boolean> {
  try {
    await getCloudResume(id);
    return true;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      return false;
    }
    throw error;
  }
}
