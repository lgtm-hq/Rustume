import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render } from "@solidjs/testing-library";
import { axeConfig } from "../../../test/a11y";
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

// TipTap does not run under jsdom; replace the lazy editor with a plain textarea.
vi.mock("../../ui/LazyRichTextEditor", () => ({
  LazyRichTextEditor: (props: {
    value?: string;
    placeholder?: string;
    onInput?: (value: string) => void;
  }) => (
    <textarea
      aria-label="Cover letter body"
      placeholder={props.placeholder}
      value={props.value ?? ""}
      onInput={(event) => props.onInput?.(event.currentTarget.value)}
    />
  ),
}));

describe("CoverLetterEditor", () => {
  beforeEach(() => {
    resumeStore.createNewResume("cover-letter-editor-test");
  });

  it("renders recipient fields and the letter body", () => {
    const { getByLabelText } = render(() => <CoverLetterEditor />);

    expect(getByLabelText("Name")).toBeInTheDocument();
    expect(getByLabelText("Title")).toBeInTheDocument();
    expect(getByLabelText("Company")).toBeInTheDocument();
    expect(getByLabelText("Email")).toBeInTheDocument();
    expect(getByLabelText("Address")).toBeInTheDocument();
    expect(getByLabelText("Cover letter body")).toBeInTheDocument();
  });

  it("updates the store when recipient fields change", () => {
    const { getByLabelText } = render(() => <CoverLetterEditor />);

    fireEvent.input(getByLabelText("Name"), { target: { value: "Jane Smith" } });
    fireEvent.input(getByLabelText("Company"), { target: { value: "Acme Corp" } });

    expect(resumeStore.store.resume!.sections.coverLetter.recipient.name).toBe("Jane Smith");
    expect(resumeStore.store.resume!.sections.coverLetter.recipient.company).toBe("Acme Corp");
  });

  it("updates the store when the body changes", () => {
    const { getByLabelText } = render(() => <CoverLetterEditor />);

    fireEvent.input(getByLabelText("Cover letter body"), {
      target: { value: "<p>Dear Jane,</p>" },
    });

    expect(resumeStore.store.resume!.sections.coverLetter.content).toBe("<p>Dear Jane,</p>");
  });

  it("has no axe violations", async () => {
    const { container } = render(() => <CoverLetterEditor />);

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
