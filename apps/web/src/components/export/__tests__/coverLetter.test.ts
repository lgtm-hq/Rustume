import { describe, expect, it } from "vitest";
import { createDefaultResume } from "../../../wasm/defaults";
import type { ResumeData } from "../../../wasm/types";
import { buildCoverLetterOnlyResume, hasCoverLetterContent } from "../coverLetter";

function createResumeWithCoverLetter(content = "<p>Dear Jane,</p>"): ResumeData {
  const resume = createDefaultResume();
  resume.sections.coverLetter.content = content;
  return resume;
}

describe("hasCoverLetterContent", () => {
  it("returns true when the cover letter has body content", () => {
    expect(hasCoverLetterContent(createResumeWithCoverLetter())).toBe(true);
  });

  it("returns false for an empty body", () => {
    expect(hasCoverLetterContent(createResumeWithCoverLetter(""))).toBe(false);
  });

  it("returns false for a TipTap-empty body", () => {
    expect(hasCoverLetterContent(createResumeWithCoverLetter("<p></p>"))).toBe(false);
    expect(hasCoverLetterContent(createResumeWithCoverLetter("<p>&nbsp;</p>"))).toBe(false);
  });

  it("returns false when the section is missing entirely", () => {
    const resume = createDefaultResume();
    delete (resume.sections as { coverLetter?: unknown }).coverLetter;
    expect(hasCoverLetterContent(resume)).toBe(false);
  });
});

describe("buildCoverLetterOnlyResume", () => {
  it("produces a layout containing only the coverLetter section", () => {
    const clone = buildCoverLetterOnlyResume(createResumeWithCoverLetter());
    expect(clone.metadata.layout).toEqual([[["coverLetter"]]]);
  });

  it("forces the cover letter visible in the copy", () => {
    const resume = createResumeWithCoverLetter();
    resume.sections.coverLetter.visible = false;
    const clone = buildCoverLetterOnlyResume(resume);
    expect(clone.sections.coverLetter.visible).toBe(true);
  });

  it("throws when the section is missing entirely", () => {
    const resume = createDefaultResume();
    delete (resume.sections as { coverLetter?: unknown }).coverLetter;
    expect(() => buildCoverLetterOnlyResume(resume)).toThrow("Resume has no cover letter section");
  });

  it("does not mutate the original resume", () => {
    const resume = createResumeWithCoverLetter();
    resume.sections.coverLetter.visible = false;
    const originalLayout = JSON.parse(JSON.stringify(resume.metadata.layout)) as string[][][];

    buildCoverLetterOnlyResume(resume);

    expect(resume.sections.coverLetter.visible).toBe(false);
    expect(resume.metadata.layout).toEqual(originalLayout);
  });

  it("preserves basics and other sections for the letterhead", () => {
    const resume = createResumeWithCoverLetter();
    const clone = buildCoverLetterOnlyResume(resume);
    expect(clone.basics.name).toBe(resume.basics.name);
    expect(clone.metadata.template).toBe(resume.metadata.template);
    expect(clone.sections.coverLetter.content).toBe(resume.sections.coverLetter.content);
  });
});
