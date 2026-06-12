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
const blockedCloudWrites = new Set<string>();

/** Thrown when cloud writes are blocked until the resume is reloaded. */
export class CloudWriteBlockedError extends Error {
  constructor(public readonly resumeId: string) {
    super(`Cloud writes blocked for resume ${resumeId} until reload`);
    this.name = "CloudWriteBlockedError";
  }
}

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

export function isCloudWriteBlocked(id: string): boolean {
  return blockedCloudWrites.has(id);
}

export function blockCloudWritesUntilReload(id: string): void {
  blockedCloudWrites.add(id);
}

export function clearCloudWriteBlock(id: string): void {
  blockedCloudWrites.delete(id);
}

export function isResumeVersionConflictError(error: unknown): error is ResumeVersionConflictError {
  return error instanceof ResumeVersionConflictError;
}

export function isCloudWriteBlockedError(error: unknown): error is CloudWriteBlockedError {
  return error instanceof CloudWriteBlockedError;
}

export function showResumeVersionConflictToast(id: string): void {
  blockCloudWritesUntilReload(id);
  toast.warning("Resume was updated elsewhere. Reload to see latest changes.", "Conflict", {
    label: "Reload",
    onClick: () => window.location.reload(),
  });
}

function assertCloudWriteAllowed(id: string): void {
  if (isCloudWriteBlocked(id)) {
    throw new CloudWriteBlockedError(id);
  }
}

function handleVersionConflict(id: string, error: unknown): never {
  if (error instanceof ResumeVersionConflictError) {
    blockCloudWritesUntilReload(id);
  }
  throw error;
}

export async function listCloudResumeSummaries(): Promise<CloudResumeSummary[]> {
  return listCloudResumes();
}

export async function loadCloudResume(id: string): Promise<ResumeData> {
  try {
    const row = await getCloudResume(id);
    clearCloudWriteBlock(id);
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
  assertCloudWriteAllowed(id);
  const resolvedTitle = title ?? deriveTitleFromResume(data);
  try {
    const row = await upsertCloudResume(id, data, resolvedTitle, getCloudResumeVersion(id));
    setCloudResumeVersion(id, row.version);
  } catch (error: unknown) {
    handleVersionConflict(id, error);
  }
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
  clearCloudWriteBlock(id);
  setCloudResumeVersion(id, row.version);
}

export async function removeCloudResume(id: string): Promise<void> {
  await deleteCloudResume(id);
  clearCloudResumeVersion(id);
  clearCloudWriteBlock(id);
}

export async function renameCloudResume(id: string, title: string): Promise<void> {
  assertCloudWriteAllowed(id);
  try {
    const row = await updateCloudResume(id, {
      title,
      version: getCloudResumeVersion(id),
    });
    setCloudResumeVersion(id, row.version);
  } catch (error: unknown) {
    handleVersionConflict(id, error);
  }
}

export async function duplicateCloudResume(
  _sourceId: string,
  newId: string,
  data: ResumeData,
  title: string,
): Promise<void> {
  const row = await createCloudResume({ id: newId, title, data });
  clearCloudWriteBlock(newId);
  setCloudResumeVersion(newId, row.version);
}

export async function cloudResumeExists(id: string): Promise<boolean> {
  try {
    const row = await getCloudResume(id);
    clearCloudWriteBlock(id);
    setCloudResumeVersion(id, row.version);
    return true;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      return false;
    }
    throw error;
  }
}
