import type { ResumeData } from "../../wasm/types";
import { isHtmlEmpty } from "../../stores/resume";

/** True when the cover letter has body content worth exporting. */
export function hasCoverLetterContent(resume: ResumeData): boolean {
  const coverLetter = resume.sections.coverLetter;
  if (!coverLetter) return false;
  return !isHtmlEmpty(coverLetter.content);
}

/**
 * Build a standalone-cover-letter copy of a resume.
 *
 * The render/export APIs accept full resume data and honor `metadata.layout`,
 * so a separate cover letter PDF needs no server changes: export a clone whose
 * layout contains only the `coverLetter` section, forced visible.
 */
export function buildCoverLetterOnlyResume(resume: ResumeData): ResumeData {
  const clone = JSON.parse(JSON.stringify(resume)) as ResumeData;
  clone.sections.coverLetter.visible = true;
  clone.metadata.layout = [[["coverLetter"]]];
  return clone;
}
