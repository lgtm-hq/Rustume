import type { ResumeData } from "../../wasm/types";

export type PdfExportScope = "resume" | "coverLetter";

/** Deep-copy a resume and restrict layout to cover letter only for standalone PDF export. */
export function buildCoverLetterOnlyResume(resume: ResumeData): ResumeData {
  const copy = JSON.parse(JSON.stringify(resume)) as ResumeData;
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
