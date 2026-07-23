import { describe, expect, it, vi, beforeEach } from "vitest";
import { createDefaultResume } from "../../../wasm/defaults";
import { downloadPdf, renderPdf } from "../../../api/render";
import { fetchBlob } from "../../../api/client";
import {
  buildCoverLetterOnlyResume,
  pdfExportFileName,
  resumeForPdfExport,
} from "../coverLetterExport";

vi.mock("../../../api/client", () => ({
  fetchBlob: vi.fn(),
  fetchBlobWithHeaders: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

describe("coverLetterExport", () => {
  beforeEach(() => {
    vi.mocked(fetchBlob).mockReset();
    vi.mocked(fetchBlob).mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
  });

  it("buildCoverLetterOnlyResume sets layout to coverLetter only and forces visibility", () => {
    const resume = createDefaultResume();
    resume.sections.coverLetter.visible = false;
    resume.sections.coverLetter.content = "<p>Hi</p>";
    resume.metadata.layout = [[["summary", "experience"], ["skills"]]];

    const only = buildCoverLetterOnlyResume(resume);

    expect(only.metadata.layout).toEqual([[["coverLetter"]]]);
    expect(only.sections.coverLetter.visible).toBe(true);
    expect(only.sections.coverLetter.content).toBe("<p>Hi</p>");
    // Original unchanged
    expect(resume.metadata.layout).toEqual([[["summary", "experience"], ["skills"]]]);
    expect(resume.sections.coverLetter.visible).toBe(false);
  });

  it("resumeForPdfExport returns original for resume scope", () => {
    const resume = createDefaultResume();
    expect(resumeForPdfExport(resume, "resume")).toBe(resume);
  });

  it("pdfExportFileName suffixes cover letter exports", () => {
    const resume = createDefaultResume();
    resume.basics.name = "Jane Doe";
    expect(pdfExportFileName(resume, "resume")).toBe("jane-doe");
    expect(pdfExportFileName(resume, "coverLetter")).toBe("jane-doe-cover-letter");
  });

  it("cover-letter-only PDF export sends layout [[['coverLetter']]]", async () => {
    const resume = createDefaultResume();
    resume.basics.name = "Pat Lee";
    resume.sections.coverLetter.visible = true;
    resume.sections.coverLetter.content = "<p>Body</p>";
    resume.metadata.layout = [[["summary", "coverLetter", "experience"]]];

    const payload = resumeForPdfExport(resume, "coverLetter");
    await renderPdf(payload);

    expect(fetchBlob).toHaveBeenCalledWith(
      "/render/pdf",
      expect.objectContaining({
        resume: expect.objectContaining({
          metadata: expect.objectContaining({
            layout: [[["coverLetter"]]],
          }),
          sections: expect.objectContaining({
            coverLetter: expect.objectContaining({
              visible: true,
              content: "<p>Body</p>",
            }),
          }),
        }),
      }),
    );
  });

  it("downloadPdf accepts a cover-letter-only resume copy", async () => {
    const mockCreateObjectURL = vi.fn(() => "blob:mock");
    const mockRevokeObjectURL = vi.fn();
    const originalCreate = globalThis.URL.createObjectURL;
    const originalRevoke = globalThis.URL.revokeObjectURL;
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "a") {
        return { click: clickSpy, href: "", download: "" } as unknown as HTMLAnchorElement;
      }
      return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    }) as typeof document.createElement);

    try {
      const resume = createDefaultResume();
      resume.basics.name = "Pat Lee";
      const only = buildCoverLetterOnlyResume(resume);
      await downloadPdf(only, "pat-lee-cover-letter.pdf");

      expect(fetchBlob).toHaveBeenCalledWith(
        "/render/pdf",
        expect.objectContaining({
          resume: expect.objectContaining({
            metadata: expect.objectContaining({
              layout: [[["coverLetter"]]],
            }),
          }),
        }),
      );
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      globalThis.URL.createObjectURL = originalCreate;
      globalThis.URL.revokeObjectURL = originalRevoke;
      appendSpy.mockRestore();
      removeSpy.mockRestore();
      vi.restoreAllMocks();
    }
  });
});
