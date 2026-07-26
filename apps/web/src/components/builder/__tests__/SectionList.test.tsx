import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resumeStore } from "../../../stores/resume";
import { createDefaultResume } from "../../../wasm/defaults";
import type { ResumeData } from "../../../wasm/types";
import { SectionList } from "../SectionList";

vi.mock("../../../wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../wasm")>();
  return {
    ...actual,
    saveResume: vi.fn().mockResolvedValue(undefined),
    isWasmReady: () => false,
  };
});

describe("SectionList", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it.each([null, { name: null, title: 42, company: {}, address: "", email: false }])(
    "renders when cover letter recipient is malformed: %j",
    (recipient) => {
      const resume = createDefaultResume() as ResumeData;
      resume.sections.coverLetter.visible = true;
      resume.sections.coverLetter.content = "";
      (resume.sections.coverLetter as unknown as { recipient: unknown }).recipient = recipient;

      resumeStore.importResume(resume);

      render(() => <SectionList />);

      expect(screen.getByText("Cover Letter")).toBeInTheDocument();
    },
  );
});
