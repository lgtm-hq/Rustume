import type { ResumeData } from "../../wasm/types";
import { isHtmlEmpty } from "../../stores/resume";

export type PdfExportScope = "resume" | "coverLetter";

/** True when the resume has non-empty cover letter body content. */
export function hasCoverLetterContent(resume: ResumeData): boolean {
  const coverLetter = resume.sections.coverLetter;
  if (!coverLetter) return false;
  return !isHtmlEmpty(coverLetter.content);
}

/** Deep-copy a resume and restrict layout to cover letter only for standalone PDF export. */
export function buildCoverLetterOnlyResume(resume: ResumeData): ResumeData {
  const copy = JSON.parse(JSON.stringify(resume)) as ResumeData;
  if (!copy.sections.coverLetter) {
    throw new Error("Resume has no cover letter section");
  }
  copy.sections.coverLetter.visible = true;
  copy.metadata.layout = [[["coverLetter"]]];
  return copy;
}

/** Resume payload for PDF export given the selected scope. */
export function resumeForPdfExport(resume: ResumeData, scope: PdfExportScope): ResumeData {
  if (scope === "coverLetter") {
    return buildCoverLetterOnlyResume(resume);
  }
  return resume;
}

/** Filename (without extension) for a PDF export scope. */
export function pdfExportFileName(resume: ResumeData, scope: PdfExportScope): string {
  const base = resume.basics.name || "resume";
  const safe =
    base
      .toLowerCase()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "resume";
  return scope === "coverLetter" ? `${safe}-cover-letter` : safe;
}
