import { fetchBlob, get, post } from "./client";
import type { ResumeData, TemplateInfo, ValidationResult } from "../wasm/types";

export interface RenderRequest {
  resume: ResumeData;
  template?: string;
}

export interface PreviewRequest extends RenderRequest {
  page: number;
}

export interface ParseRequest {
  format: "json-resume" | "linkedin" | "rrv3" | "rustume";
  data: string;
  base64?: boolean;
}

// Preview cache to avoid redundant fetches
const previewCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

function getCacheKey(resume: ResumeData, template: string, page: number): string {
  // Simple hash based on content
  const content = JSON.stringify({ resume, template, page });
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export async function renderPreview(
  resume: ResumeData,
  page: number = 0,
  template?: string
): Promise<string> {
  const templateName = template || resume.metadata.template;
  const cacheKey = getCacheKey(resume, templateName, page);

  // Check cache
  const cached = previewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }

  const blob = await fetchBlob("/render/preview", {
    resume,
    template: templateName,
    page,
  } satisfies PreviewRequest);

  // Revoke old URL if exists
  if (cached) {
    URL.revokeObjectURL(cached.url);
  }

  const url = URL.createObjectURL(blob);
  previewCache.set(cacheKey, { url, timestamp: Date.now() });

  return url;
}

export async function renderPdf(
  resume: ResumeData,
  template?: string
): Promise<Blob> {
  return fetchBlob("/render/pdf", {
    resume,
    template: template || resume.metadata.template,
  } satisfies RenderRequest);
}

export async function downloadPdf(
  resume: ResumeData,
  filename: string = "resume.pdf",
  template?: string
): Promise<void> {
  const blob = await renderPdf(resume, template);
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

export async function fetchTemplates(): Promise<TemplateInfo[]> {
  return get<TemplateInfo[]>("/templates");
}

export function getTemplateThumbnailUrl(templateId: string): string {
  // Use the API URL for template thumbnails
  const baseUrl = import.meta.env.VITE_API_URL || "";
  return `${baseUrl}/api/templates/${templateId}/thumbnail`;
}

export async function validateResumeServer(
  resume: ResumeData
): Promise<ValidationResult> {
  return post<ValidationResult>("/validate", resume);
}

export async function parseResume(request: ParseRequest): Promise<ResumeData> {
  return post<ResumeData>("/parse", request);
}

// Cleanup function to revoke all cached URLs
export function clearPreviewCache(): void {
  for (const { url } of previewCache.values()) {
    URL.revokeObjectURL(url);
  }
  previewCache.clear();
}
