import type { ResumeData } from "../wasm/types";
import { ApiError, del, get, post, put } from "./client";

export interface CloudResumeSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface PaginatedCloudResumeSummaries {
  items: CloudResumeSummary[];
  total: number;
  page: number;
  per_page: number;
}

export interface CloudResumeRow extends CloudResumeSummary {
  user_id: string;
  data: ResumeData;
  is_public: boolean;
  public_slug: string | null;
  version: number;
  created_at: string;
}

export interface ImportResumeItem {
  id?: string;
  title?: string;
  data: ResumeData;
}

export interface ImportBatchFailure {
  offset: number;
  count: number;
  message: string;
}

export interface ImportResumesResult {
  imported: CloudResumeSummary[];
  failures: ImportBatchFailure[];
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

export async function listCloudResumesPage(
  page = 1,
  perPage = 100,
): Promise<PaginatedCloudResumeSummaries> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  return get<PaginatedCloudResumeSummaries>(`/resumes?${params.toString()}`);
}

/** Fetch all resume summaries, following pagination until complete. */
export async function listCloudResumes(): Promise<CloudResumeSummary[]> {
  const summaries: CloudResumeSummary[] = [];
  let page = 1;

  loop: while (true) {
    const response = await listCloudResumesPage(page);
    summaries.push(...response.items);

    if (summaries.length >= response.total || response.items.length === 0) {
      break loop;
    }

    page += 1;
  }

  return summaries;
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

interface ImportBatchResponse {
  imported: CloudResumeSummary[];
  failed: Array<{ id?: string; error: string }>;
}

export async function importResumes(resumes: ImportResumeItem[]): Promise<ImportResumesResult> {
  const imported: CloudResumeSummary[] = [];
  const failures: ImportBatchFailure[] = [];

  for (let offset = 0; offset < resumes.length; offset += MAX_IMPORT_BATCH) {
    const batch = resumes.slice(offset, offset + MAX_IMPORT_BATCH);
    try {
      const batchResult = await post<ImportBatchResponse>("/resumes/import", { resumes: batch });
      imported.push(...batchResult.imported);
      if (batchResult.failed.length > 0) {
        failures.push({
          offset,
          count: batchResult.failed.length,
          message: batchResult.failed.map((item) => item.error).join("; "),
        });
      }
    } catch (error: unknown) {
      failures.push({
        offset,
        count: batch.length,
        message: error instanceof Error ? error.message : "Import batch failed",
      });
    }
  }

  return { imported, failures };
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
