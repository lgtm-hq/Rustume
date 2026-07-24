import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { CoverLetterEditor } from "../CoverLetterEditor";
import { resumeStore } from "../../../stores/resume";

vi.mock("../../../wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../wasm")>();
  return {
    ...actual,
    saveResume: vi.fn().mockResolvedValue(undefined),
    isWasmReady: () => false,
  };
});

vi.mock("../../ui/LazyRichTextEditor", () => ({
  LazyRichTextEditor: (props: {
    value: string;
    onInput: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="Cover letter body"
      placeholder={props.placeholder}
      value={props.value}
      onInput={(e) => props.onInput((e.currentTarget as HTMLTextAreaElement).value)}
    />
  ),
}));

describe("CoverLetterEditor", () => {
  beforeEach(() => {
    localStorage.clear();
    resumeStore.createNewResume("cover-letter-editor-test");
  });

  it("renders recipient fields and body editor", () => {
    render(() => <CoverLetterEditor />);

    expect(screen.getByRole("heading", { name: "Cover Letter" })).toBeTruthy();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText("Company")).toBeTruthy();
    expect(screen.getByLabelText("Address")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Cover letter body")).toBeTruthy();
  });

  it("propagates recipient and content edits to the store", async () => {
    render(() => <CoverLetterEditor />);

    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "Alex Rivera" } });
    fireEvent.input(screen.getByLabelText("Company"), { target: { value: "Orbit Labs" } });
    fireEvent.input(screen.getByLabelText("Cover letter body"), {
      target: { value: "<p>Hello</p>" },
    });

    await waitFor(() => {
      expect(resumeStore.store.resume!.sections.coverLetter.recipient.name).toBe("Alex Rivera");
      expect(resumeStore.store.resume!.sections.coverLetter.recipient.company).toBe("Orbit Labs");
      expect(resumeStore.store.resume!.sections.coverLetter.content).toBe("<p>Hello</p>");
    });
  });

  it("toggles cover letter visibility", async () => {
    render(() => <CoverLetterEditor />);

    expect(resumeStore.store.resume!.sections.coverLetter.visible).toBe(false);

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(resumeStore.store.resume!.sections.coverLetter.visible).toBe(true);
    });
  });
});
