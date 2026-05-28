import type { ResumeData } from "../wasm/types";
import { ApiError, del, get, post, put } from "./client";

export interface CloudResumeSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface CloudResumeRow extends CloudResumeSummary {
  user_id: string;
  data: ResumeData;
  is_public: boolean;
  public_slug: string | null;
  password_hash: string | null;
  version: number;
  created_at: string;
}

export interface ImportResumeItem {
  id?: string;
  title?: string;
  data: ResumeData;
}

export interface CreateResumePayload {
  id?: string;
  title?: string;
  data: ResumeData;
}

export interface UpdateResumePayload {
  title?: string;
  data?: ResumeData;
}

export async function listCloudResumes(): Promise<CloudResumeSummary[]> {
  return get<CloudResumeSummary[]>("/resumes");
}

export async function getCloudResume(id: string): Promise<CloudResumeRow> {
  return get<CloudResumeRow>(`/resumes/${id}`);
}

export async function createCloudResume(payload: CreateResumePayload): Promise<CloudResumeRow> {
  return post<CloudResumeRow>("/resumes", payload);
}

export async function updateCloudResume(
  id: string,
  payload: UpdateResumePayload,
): Promise<CloudResumeRow> {
  return put<CloudResumeRow>(`/resumes/${id}`, payload);
}

export async function deleteCloudResume(id: string): Promise<void> {
  await del(`/resumes/${id}`);
}

export const MAX_IMPORT_BATCH = 100;

export async function importResumes(resumes: ImportResumeItem[]): Promise<CloudResumeSummary[]> {
  const imported: CloudResumeSummary[] = [];

  for (let offset = 0; offset < resumes.length; offset += MAX_IMPORT_BATCH) {
    const batch = resumes.slice(offset, offset + MAX_IMPORT_BATCH);
    const batchResult = await post<CloudResumeSummary[]>("/resumes/import", { resumes: batch });
    imported.push(...batchResult);
  }

  return imported;
}

export async function upsertCloudResume(
  id: string,
  data: ResumeData,
  title?: string,
): Promise<CloudResumeRow> {
  const payload = { title, data };
  try {
    return await updateCloudResume(id, payload);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      try {
        return await createCloudResume({ id, ...payload });
      } catch (createError: unknown) {
        if (createError instanceof ApiError && createError.status === 409) {
          return updateCloudResume(id, payload);
        }
        throw createError;
      }
    }
    throw error;
  }
}
