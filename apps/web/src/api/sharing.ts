import type { ResumeData } from "../wasm/types";
import { ApiError, put } from "./client";

export interface SharingResponse {
  is_public: boolean;
  public_slug: string | null;
}

export interface PublicResumeData {
  id: string;
  title: string;
  data: ResumeData;
  updated_at: string;
}

export async function updateSharing(id: string, isPublic: boolean): Promise<SharingResponse> {
  return put<SharingResponse>(`/resumes/${id}/sharing`, { is_public: isPublic });
}

export async function fetchPublicResume(slug: string): Promise<PublicResumeData> {
  const response = await fetch(`/r/${encodeURIComponent(slug)}/data`);

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new ApiError(response.status, "Expected JSON response");
  }

  return response.json() as Promise<PublicResumeData>;
}
