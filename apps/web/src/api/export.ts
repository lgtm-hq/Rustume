import { ApiError } from "./client";

async function throwApiError(response: Response): Promise<never> {
  const text = await response.text();
  let message = text;
  try {
    const json = JSON.parse(text) as { error?: string };
    if (typeof json.error === "string") {
      message = json.error;
    }
  } catch {
    // Keep raw text when the body is not JSON.
  }
  throw new ApiError(response.status, message || response.statusText);
}

export interface ResumeExportItem {
  id: string;
  title: string;
  data: unknown;
}

export interface ResumeBulkExport {
  exported_at: string;
  resumes: ResumeExportItem[];
}

/** Download all cloud resumes as a JSON bundle. */
export async function exportResumesJson(): Promise<ResumeBulkExport> {
  const response = await fetch("/api/resumes/export", { credentials: "include" });
  if (!response.ok) {
    throw await throwApiError(response);
  }
  return response.json() as Promise<ResumeBulkExport>;
}

/** Download all cloud resumes as a ZIP of PDF files. */
export async function exportResumesPdf(): Promise<Blob> {
  const response = await fetch("/api/resumes/export/pdf", { credentials: "include" });
  if (!response.ok) {
    throw await throwApiError(response);
  }
  return response.blob();
}

/** Trigger a browser download for exported data. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
}

/** Download all resumes as a JSON file. */
export async function downloadResumesJson(): Promise<void> {
  const payload = await exportResumesJson();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const stamp = payload.exported_at.slice(0, 10);
  downloadBlob(blob, `rustume-export-${stamp}.json`);
}

/** Download all resumes as a ZIP of PDF files. */
export async function downloadResumesPdf(): Promise<void> {
  const blob = await exportResumesPdf();
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `rustume-resumes-${stamp}.zip`);
}
