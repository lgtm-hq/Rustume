import type { ResumeData } from "../wasm/types";
import { post } from "./client";

export interface CloudResumeSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface ImportResumeItem {
  title?: string;
  data: ResumeData;
}

export async function importResumes(resumes: ImportResumeItem[]): Promise<CloudResumeSummary[]> {
  return post<CloudResumeSummary[]>("/resumes/import", { resumes });
}
