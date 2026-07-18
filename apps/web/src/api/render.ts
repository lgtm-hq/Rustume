import { fetchBlob, fetchBlobWithHeaders, get, post } from "./client";
import { resumeDataSchema, templateListSchema, validationResultSchema } from "./schemas";
import type { ResumeData, TemplateInfo, ValidationResult } from "../wasm/types";

/** Plain snapshot for HTTP JSON bodies — avoids edge cases with reactive proxies. */
function cloneResumeForApi(resume: ResumeData): ResumeData {
  return JSON.parse(JSON.stringify(resume)) as ResumeData;
}

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

export interface PreviewResult {
  url: string;
  totalPages: number;
}

// Preview cache to avoid redundant fetches
const previewCache = new Map<string, { url: string; totalPages: number; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/** Build a collision-resistant preview cache key from the full request payload. */
export function getCacheKey(resume: ResumeData, template: string, page: number): string {
  return JSON.stringify({ resume, template, page });
}

// Clean up expired cache entries to prevent memory leaks
function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of previewCache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL) {
      URL.revokeObjectURL(entry.url);
      previewCache.delete(key);
    }
  }
}

export async function renderPreview(
  resume: ResumeData,
  page: number = 0,
  template?: string,
): Promise<PreviewResult> {
  // Clean up expired entries before processing
  cleanupExpiredCache();

  const templateName = template || resume.metadata.template;
  const plain = cloneResumeForApi(resume);
  const cacheKey = getCacheKey(plain, templateName, page);

  // Check cache
  const cached = previewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { url: cached.url, totalPages: cached.totalPages };
  }

  const { blob, headers } = await fetchBlobWithHeaders("/render/preview", {
    resume: plain,
    template: templateName,
    page,
  } satisfies PreviewRequest);

  const parsedTotalPages = parseInt(headers.get("X-Total-Pages") || "1", 10);
  const totalPages =
    Number.isFinite(parsedTotalPages) && parsedTotalPages > 0 ? parsedTotalPages : 1;

  // Revoke old URL if exists
  if (cached) {
    URL.revokeObjectURL(cached.url);
  }

  const url = URL.createObjectURL(blob);
  previewCache.set(cacheKey, { url, totalPages, timestamp: Date.now() });

  return { url, totalPages };
}

export async function renderPdf(resume: ResumeData, template?: string): Promise<Blob> {
  const plain = cloneResumeForApi(resume);
  return fetchBlob("/render/pdf", {
    resume: plain,
    template: template || plain.metadata.template,
  } satisfies RenderRequest);
}

export async function downloadPdf(
  resume: ResumeData,
  filename: string = "resume.pdf",
  template?: string,
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
  return get("/templates", templateListSchema) as unknown as Promise<TemplateInfo[]>;
}

export function getTemplateThumbnailUrl(templateId: string): string {
  // Use the API URL for template thumbnails, normalizing to avoid double /api
  let baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (baseUrl.endsWith("/api")) {
    baseUrl = baseUrl.slice(0, -4);
  }
  return `${baseUrl}/api/templates/${templateId}/thumbnail`;
}

export async function validateResumeServer(resume: ResumeData): Promise<ValidationResult> {
  return post(
    "/validate",
    cloneResumeForApi(resume),
    validationResultSchema,
  ) as unknown as Promise<ValidationResult>;
}

export async function parseResume(request: ParseRequest): Promise<ResumeData> {
  return post("/parse", request, resumeDataSchema) as unknown as Promise<ResumeData>;
}

// Cleanup function to revoke all cached URLs
export function clearPreviewCache(): void {
  for (const { url } of previewCache.values()) {
    URL.revokeObjectURL(url);
  }
  previewCache.clear();
}
