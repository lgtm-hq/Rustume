import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { loadDocEditorFixture, SINGLE_TEMPLATE } from "../../../test/docEditorFixture";
import { DocSheet } from "../DocSheet";
import type { ResumeData } from "../../../wasm/types";

const store = vi.hoisted(() => ({
  updateBasics: vi.fn(),
  updateSummary: vi.fn(),
  updateCoverLetter: vi.fn(),
  updateSectionName: vi.fn(),
  updateSectionItem: vi.fn(),
  addSectionItem: vi.fn(),
  updateCustomSection: vi.fn(),
  addCustomSection: vi.fn(() => "custom-1"),
  updateCustomSectionItem: vi.fn(),
  addCustomSectionItem: vi.fn(),
}));

vi.mock("../../../stores/resume", () => ({ resumeStore: store }));

/** Total writes recorded across every mocked store action. */
function writeCount(): number {
  return Object.values(store).reduce((total, action) => total + action.mock.calls.length, 0);
}

describe("document sheet inline editing", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
  });

  function renderSheet() {
    return render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
  }

  /**
   * Open the editor behind the value `name` and return its input.
   *
   * `scope` narrows the search when the same text is drawn twice — a headline
   * and a job title can read identically.
   */
  function edit(name: string, fieldLabel: string, scope?: HTMLElement): HTMLInputElement {
    const region = scope ? within(scope) : screen;
    fireEvent.click(region.getByRole("button", { name }));
    return region.getByRole("textbox", { name: fieldLabel }) as HTMLInputElement;
  }

  /** The header region, where the basics are drawn. */
  function header(): HTMLElement {
    return screen.getAllByTestId("doc-sheet-header")[0];
  }

  it.each([
    { key: "Escape", changed: false },
    { key: "Enter", changed: false },
    { key: "Enter", changed: true },
  ])("hands focus back to the trigger after $key (changed: $changed)", async ({ key, changed }) => {
    renderSheet();

    const input = edit("Mireille Okafor", "Name", header());
    if (changed) fireEvent.input(input, { target: { value: "Ada Lovelace" } });
    fireEvent.keyDown(input, { key });

    // A keyboard edit must not strand focus on <body>: the next Tab has to
    // carry on from the field, not restart at the top of the document.
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById("doc-header-name")),
    );
  });

  it("leaves focus alone when the edit ends by blurring", async () => {
    renderSheet();

    const input = edit("Mireille Okafor", "Name", header());
    const elsewhere = document.getElementById("doc-header-headline") as HTMLElement;
    elsewhere.focus();
    fireEvent.blur(input);

    // The user chose where focus goes; refocusing the trigger would fight them.
    await waitFor(() => expect(document.activeElement).toBe(elsewhere));
  });

  it("commits a basics field on blur, through one store action", () => {
    renderSheet();

    const input = edit("Mireille Okafor", "Name", header());
    fireEvent.input(input, { target: { value: "Ada Lovelace" } });
    fireEvent.blur(input);

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("name", "Ada Lovelace");
    expect(writeCount()).toBe(1);
  });

  it("commits on Enter", () => {
    renderSheet();

    const input = edit("Principal Design Systems Engineer", "Headline", header());
    fireEvent.input(input, { target: { value: "Design Systems Lead" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("headline", "Design Systems Lead");
    expect(writeCount()).toBe(1);
  });

  it("restores the prior value on Escape without writing", () => {
    renderSheet();

    const input = edit("mireille@okafor.design", "Email", header());
    fireEvent.input(input, { target: { value: "typo@example.com" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(writeCount()).toBe(0);
    expect(screen.getByRole("button", { name: "mireille@okafor.design" })).toBeInTheDocument();
  });

  it("writes nothing when the text is left unchanged", () => {
    renderSheet();

    const input = edit("Lisbon, Portugal", "Location", header());
    fireEvent.blur(input);

    expect(writeCount()).toBe(0);
  });

  it("commits an item field through updateSectionItem at the item's own index", () => {
    renderSheet();

    const input = edit("Lumen Health", "Company");
    fireEvent.input(input, { target: { value: "Lumen Health Group" } });
    fireEvent.blur(input);

    expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
      company: "Lumen Health Group",
    });
    expect(writeCount()).toBe(1);
  });

  it("commits a custom-section item through updateCustomSectionItem", () => {
    renderSheet();

    const input = edit("Design Tokens Beyond Colour", "Name");
    fireEvent.input(input, { target: { value: "Design Tokens, Beyond Colour" } });
    fireEvent.blur(input);

    expect(store.updateCustomSectionItem).toHaveBeenCalledExactlyOnceWith("speaking", 0, {
      name: "Design Tokens, Beyond Colour",
    });
  });

  it("renames a fixed section through updateSectionName", () => {
    renderSheet();

    const input = edit("Experience", "Section title");
    fireEvent.input(input, { target: { value: "Work" } });
    fireEvent.blur(input);

    expect(store.updateSectionName).toHaveBeenCalledExactlyOnceWith("experience", "Work");
  });

  it("renames a custom section through updateCustomSection", () => {
    renderSheet();

    const input = edit("Talks & Workshops", "Section title");
    fireEvent.input(input, { target: { value: "Talks" } });
    fireEvent.blur(input);

    expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
      name: "Talks",
    });
  });

  it("offers empty core fields as reachable placeholders", () => {
    resume.basics.phone = "";
    renderSheet();

    const input = edit("Add phone", "Phone", header());
    fireEvent.input(input, { target: { value: "+351 000 000" } });
    fireEvent.blur(input);

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("phone", "+351 000 000");
  });

  it("keeps a heading's accessible name the value it draws", () => {
    renderSheet();

    // The inline trigger must not rename the heading it sits inside — an
    // `aria-label` here would make every heading announce "Edit …".
    expect(screen.getByRole("heading", { name: "Mireille Okafor" })).toBeInTheDocument();
  });
});

describe("markdown mini editor", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
  });

  /** Open the summary's markdown editor and return its textarea. */
  function openSummary(): HTMLTextAreaElement {
    render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
    const summary = document.querySelector('[data-section-id="summary"]') as HTMLElement;
    fireEvent.click(within(summary).getByTitle("Edit summary"));
    return within(summary).getByRole("textbox", { name: "Summary" }) as HTMLTextAreaElement;
  }

  function select(textarea: HTMLTextAreaElement, text: string): void {
    fireEvent.input(textarea, { target: { value: text } });
    textarea.setSelectionRange(0, text.length);
  }

  it("has no underline control — markdown has none", () => {
    openSummary();

    expect(screen.queryByRole("button", { name: /underline/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Italic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulleted list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Numbered list" })).toBeInTheDocument();
  });

  it.each([
    { action: "Bold", expected: "**text**" },
    { action: "Italic", expected: "*text*" },
    { action: "Bulleted list", expected: "- text" },
    { action: "Numbered list", expected: "1. text" },
  ])("emits $expected for $action", ({ action, expected }) => {
    const textarea = openSummary();
    select(textarea, "text");

    fireEvent.click(screen.getByRole("button", { name: action }));

    expect(textarea.value).toBe(expected);
  });

  it("emits a markdown link from the link row", () => {
    const textarea = openSummary();
    select(textarea, "Halo guide");

    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    const href = screen.getByRole("textbox", { name: "Link URL" });
    fireEvent.input(href, { target: { value: "https://halo.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply link" }));

    expect(textarea.value).toBe("[Halo guide](https://halo.example)");
  });

  it("closes the link row when another command runs", () => {
    const textarea = openSummary();
    select(textarea, "Halo guide");

    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    // The pending link held a snapshot of the pre-Bold text; applying it later
    // would have overwritten the bolding with that stale draft.
    expect(screen.queryByRole("textbox", { name: "Link URL" })).toBeNull();
    expect(textarea.value).toBe("**Halo guide**");
  });

  it("commits the markdown through updateSummary, once", () => {
    const textarea = openSummary();
    fireEvent.input(textarea, { target: { value: "Rewritten **summary**." } });

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(store.updateSummary).toHaveBeenCalledExactlyOnceWith("Rewritten **summary**.");
    expect(writeCount()).toBe(1);
  });

  it("commits an item's markdown through updateSectionItem", () => {
    render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
    const experience = document.querySelector('[data-section-id="experience"]') as HTMLElement;

    fireEvent.click(within(experience).getAllByTitle("Edit summary")[0]);
    const textarea = within(experience).getByRole("textbox", { name: "Summary" });
    fireEvent.input(textarea, { target: { value: "Shorter summary." } });
    fireEvent.click(within(experience).getByRole("button", { name: "Done" }));

    expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
      summary: "Shorter summary.",
    });
  });

  it("restores the prior markdown on Escape without writing", () => {
    const textarea = openSummary();
    fireEvent.input(textarea, { target: { value: "discarded" } });

    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(writeCount()).toBe(0);
  });
});
