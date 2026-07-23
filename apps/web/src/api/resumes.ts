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
  version?: number;
}

export interface ApiErrorBody {
  error: string;
  current_version?: number;
}

/** Thrown when a resume update fails due to optimistic concurrency control. */
export class ResumeVersionConflictError extends Error {
  constructor(
    message: string,
    public currentVersion: number,
  ) {
    super(message);
    this.name = "ResumeVersionConflictError";
  }
}

export function parseApiErrorBody(message: string): ApiErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(message);
    if (typeof parsed !== "object" || parsed === null) return null;
    const body = parsed as Record<string, unknown>;
    if (typeof body.error !== "string") return null;
    return {
      error: body.error,
      current_version: typeof body.current_version === "number" ? body.current_version : undefined,
    };
  } catch {
    return null;
  }
}

function upgradeOrRethrow409(error: ApiError): never {
  if (error.status !== 409) {
    throw error;
  }

  // Prefer the raw response body: ApiError.message is often just the extracted
  // `error` string after client parsing, which drops `current_version`.
  const body = parseApiErrorBody(error.body ?? error.message);
  if (body?.current_version !== undefined) {
    throw new ResumeVersionConflictError(body.error, body.current_version);
  }

  throw error;
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
  try {
    return await put<CloudResumeRow>(`/resumes/${id}`, payload);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      upgradeOrRethrow409(error);
    }
    throw error;
  }
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

export interface ResumeVersionSummary {
  version: number;
  created_at: string;
}

export interface ResumeSnapshot {
  id: string;
  resume_id: string;
  version: number;
  data: ResumeData;
  created_at: string;
}

export interface RestoreResumePayload {
  version: number;
}

export async function listResumeVersions(id: string): Promise<ResumeVersionSummary[]> {
  return get<ResumeVersionSummary[]>(`/resumes/${id}/versions`);
}

export async function getResumeVersion(id: string, version: number): Promise<ResumeSnapshot> {
  return get<ResumeSnapshot>(`/resumes/${id}/versions/${version}`);
}

export async function restoreResumeVersion(
  id: string,
  version: number,
  currentVersion: number,
): Promise<CloudResumeRow> {
  try {
    return await post<CloudResumeRow>(`/resumes/${id}/versions/${version}/restore`, {
      version: currentVersion,
    } satisfies RestoreResumePayload);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      upgradeOrRethrow409(error);
    }
    throw error;
  }
}

export async function upsertCloudResume(
  id: string,
  data: ResumeData,
  title?: string,
  version?: number,
): Promise<CloudResumeRow> {
  const payload: UpdateResumePayload = { title, data };
  if (version !== undefined) {
    payload.version = version;
  }

  try {
    return await updateCloudResume(id, payload);
  } catch (error: unknown) {
    if (error instanceof ResumeVersionConflictError) {
      throw error;
    }
    if (error instanceof ApiError && error.status === 404) {
      try {
        return await createCloudResume({ id, title, data });
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
