import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { loadDocEditorFixture, SINGLE_TEMPLATE } from "../../../test/docEditorFixture";
import { editableText } from "../liveTextDom";
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

/** Simulate the user's typing: the armed field's content is the draft. */
function type(field: HTMLElement, text: string): void {
  field.textContent = text;
}

/** End the edit the pointer way: focus leaves the field. */
function blurField(field: HTMLElement): void {
  fireEvent.focusOut(field);
}

describe("document sheet inline editing (LiveText)", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
  });

  function renderSheet() {
    return render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
  }

  /**
   * Arm the field behind the value `name` — the double-click of spec §1.11 —
   * and return the in-place textbox.
   *
   * `scope` narrows the search when the same text is drawn twice — a headline
   * and a job title can read identically.
   */
  function arm(name: string, fieldLabel: string, scope?: HTMLElement): HTMLElement {
    const region = scope ? within(scope) : screen;
    fireEvent.dblClick(region.getByRole("button", { name }));
    return region.getByRole("textbox", { name: fieldLabel });
  }

  /** The header region, where the name and headline are drawn. */
  function header(): HTMLElement {
    return screen.getAllByTestId("doc-sheet-header")[0];
  }

  /** The contact block, where email, phone and location are drawn (#794). */
  function contact(): HTMLElement {
    return screen.getAllByTestId("doc-sheet-contact")[0];
  }

  it("stays plain rendered content until armed — no input swap", () => {
    renderSheet();

    const trigger = within(header()).getByRole("button", { name: "Mireille Okafor" });
    // The hint is the tooltip alone; a single pointer click must not arm.
    expect(trigger).toHaveAttribute("title", "Double-click to edit name");
    fireEvent.click(trigger, { detail: 1 });
    expect(within(header()).queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("arms in place: the armed element is the editable text itself", () => {
    renderSheet();

    const field = arm("Mireille Okafor", "Name", header());
    expect(field).toHaveAttribute("contenteditable", "plaintext-only");
    expect(editableText(field)).toBe("Mireille Okafor");
  });

  it("arms from the keyboard (button activation carries no pointer detail)", () => {
    renderSheet();

    fireEvent.click(within(header()).getByRole("button", { name: "Mireille Okafor" }));
    expect(within(header()).getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  it.each([
    { key: "Escape", changed: false },
    { key: "Enter", changed: false },
    { key: "Enter", changed: true },
  ])("hands focus back to the trigger after $key (changed: $changed)", async ({ key, changed }) => {
    renderSheet();

    const field = arm("Mireille Okafor", "Name", header());
    if (changed) type(field, "Ada Lovelace");
    fireEvent.keyDown(field, { key });

    // A keyboard edit must not strand focus on <body>: the next Tab has to
    // carry on from the field, not restart at the top of the document.
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById("doc-header-name")),
    );
  });

  it("leaves focus alone when the edit ends by blurring", async () => {
    renderSheet();

    const field = arm("Mireille Okafor", "Name", header());
    const elsewhere = document.getElementById("doc-header-headline") as HTMLElement;
    elsewhere.focus();
    blurField(field);

    // The user chose where focus goes; refocusing the trigger would fight them.
    await waitFor(() => expect(document.activeElement).toBe(elsewhere));
  });

  it("commits a basics field on blur, through one store action", () => {
    renderSheet();

    const field = arm("Mireille Okafor", "Name", header());
    type(field, "Ada Lovelace");
    blurField(field);

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("name", "Ada Lovelace");
    expect(writeCount()).toBe(1);
  });

  it("commits on Enter", () => {
    renderSheet();

    const field = arm("Principal Design Systems Engineer", "Headline", header());
    type(field, "Design Systems Lead");
    fireEvent.keyDown(field, { key: "Enter" });

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("headline", "Design Systems Lead");
    expect(writeCount()).toBe(1);
  });

  it("normalises NBSP to spaces and trims trailing whitespace on commit", () => {
    renderSheet();

    const field = arm("Mireille Okafor", "Name", header());
    // A real NBSP, spelled out so no editor can silently swap it for a space.
    type(field, "Ada\u00a0Lovelace  ");
    blurField(field);

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("name", "Ada Lovelace");
  });

  it("reverts on Escape without writing — typed content included", () => {
    renderSheet();

    const field = arm("mireille@okafor.design", "Email", contact());
    type(field, "typo@example.com");
    fireEvent.keyDown(field, { key: "Escape" });

    // Owner decision: Escape throws the in-progress edit away entirely; the
    // blur that follows must not commit what was typed before it.
    blurField(field);
    expect(writeCount()).toBe(0);
    expect(screen.getByRole("button", { name: "mireille@okafor.design" })).toBeInTheDocument();
  });

  it("writes nothing when the text is left unchanged", () => {
    renderSheet();

    const field = arm("Lisbon, Portugal", "Location", contact());
    blurField(field);

    expect(writeCount()).toBe(0);
  });

  it("commits an item field through updateSectionItem at the item's own index", () => {
    renderSheet();

    const field = arm("Lumen Health", "Company");
    type(field, "Lumen Health Group");
    blurField(field);

    expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
      company: "Lumen Health Group",
    });
    expect(writeCount()).toBe(1);
  });

  it("draws custom-section items as chips with no inline editor (#794)", () => {
    renderSheet();

    // Spec §1.7: custom sections are chip lists; items are managed through
    // the add-block dialog and the chip's inline remove, never edited in
    // place. The chip removal path is covered in `sectionCards.test.tsx`.
    expect(screen.queryByRole("button", { name: "Design Tokens Beyond Colour" })).toBeNull();
    const chips = [...document.querySelectorAll(".doc-sheet__skill-chip")].map(
      (chip) => chip.textContent,
    );
    expect(chips.join(" ")).toContain("Design Tokens Beyond Colour");
  });

  it("renames a fixed section through updateSectionName", () => {
    renderSheet();

    const field = arm("Experience", "Section title");
    type(field, "Work");
    blurField(field);

    expect(store.updateSectionName).toHaveBeenCalledExactlyOnceWith("experience", "Work");
  });

  it("renames a custom section through updateCustomSection", () => {
    renderSheet();

    const field = arm("Talks & Workshops", "Section title");
    type(field, "Talks");
    blurField(field);

    expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
      name: "Talks",
    });
  });

  it("offers empty core fields as reachable placeholders", () => {
    resume.basics.phone = "";
    renderSheet();

    const field = arm("Add phone", "Phone", contact());
    type(field, "+351 000 000");
    blurField(field);

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("phone", "+351 000 000");
  });

  it("keeps a heading's accessible name the value it draws", () => {
    renderSheet();

    // The inline trigger must not rename the heading it sits inside — an
    // `aria-label` here would make every heading announce "Edit …".
    expect(screen.getByRole("heading", { name: "Mireille Okafor" })).toBeInTheDocument();
  });
});

describe("rich LiveText and the floating format toolbar", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
  });

  /** Arm the summary's rich field and return the in-place markdown textbox. */
  function armSummary(): HTMLElement {
    render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
    const summary = document.querySelector('[data-section-id="summary"]') as HTMLElement;
    fireEvent.dblClick(within(summary).getByTitle("Double-click to edit summary"));
    return within(summary).getByRole("textbox", { name: "Summary" });
  }

  /** Select `[start, end]` of the field's single text node. */
  function select(field: HTMLElement, start: number, end: number): void {
    const node = field.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const selection = window.getSelection() as Selection;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function toolbar(): HTMLElement {
    return screen.getByTestId("doc-sheet-format-toolbar");
  }

  it("arms to the raw markdown and opens the floating toolbar", () => {
    const field = armSummary();

    expect(field).toHaveAttribute("aria-multiline", "true");
    expect(editableText(field)).toBe(resume.sections.summary.content);
    expect(toolbar()).toBeInTheDocument();
  });

  it("shows no toolbar while nothing is armed", () => {
    render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);

    expect(screen.queryByTestId("doc-sheet-format-toolbar")).toBeNull();
  });

  it("has no underline or strikethrough control — markdown has neither", () => {
    armSummary();

    expect(screen.queryByRole("button", { name: /underline/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /strike/i })).toBeNull();
    expect(within(toolbar()).getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(within(toolbar()).getByRole("button", { name: "Italic" })).toBeInTheDocument();
    expect(within(toolbar()).getByRole("button", { name: "Link" })).toBeInTheDocument();
    expect(within(toolbar()).getByRole("button", { name: "Bulleted list" })).toBeInTheDocument();
    expect(within(toolbar()).getByRole("button", { name: "Numbered list" })).toBeInTheDocument();
  });

  it.each([
    { action: "Bold", expected: "**text**" },
    { action: "Italic", expected: "*text*" },
    { action: "Bulleted list", expected: "- text" },
    { action: "Numbered list", expected: "1. text" },
  ])("emits $expected for $action around the live selection", ({ action, expected }) => {
    const field = armSummary();
    type(field, "text");
    select(field, 0, 4);

    fireEvent.click(within(toolbar()).getByRole("button", { name: action }));

    expect(editableText(field)).toBe(expected);
  });

  it("emits a markdown link from the URL row — no prompt anywhere", () => {
    const field = armSummary();
    type(field, "Halo guide");
    select(field, 0, 10);

    fireEvent.click(within(toolbar()).getByRole("button", { name: "Link" }));
    const href = screen.getByRole("textbox", { name: "Link URL" });
    fireEvent.input(href, { target: { value: "https://halo.example" } });
    fireEvent.keyDown(href, { key: "Enter" });

    expect(editableText(field)).toBe("[Halo guide](https://halo.example)");
  });

  it("wraps the selection captured before the URL row stole it", () => {
    const field = armSummary();
    type(field, "Halo guide");
    select(field, 0, 4);

    fireEvent.click(within(toolbar()).getByRole("button", { name: "Link" }));
    // Focusing the URL input moves the document selection out of the field;
    // the link must act on the range captured when the row opened, or the
    // markdown would be appended at the end instead of wrapping "Halo".
    window.getSelection()?.removeAllRanges();
    const href = screen.getByRole("textbox", { name: "Link URL" });
    fireEvent.input(href, { target: { value: "https://halo.example" } });
    fireEvent.keyDown(href, { key: "Enter" });

    expect(editableText(field)).toBe("[Halo](https://halo.example) guide");
  });

  it("keeps the field armed while focus visits the URL row", () => {
    const field = armSummary();

    fireEvent.click(within(toolbar()).getByRole("button", { name: "Link" }));
    const href = screen.getByRole("textbox", { name: "Link URL" });
    fireEvent.focusOut(field, { relatedTarget: href });

    // Focus inside the toolbar is the same editing session (spec §1.12's
    // grace, made deterministic); nothing may commit yet.
    expect(writeCount()).toBe(0);
    expect(screen.getByTestId("doc-sheet-format-toolbar")).toBeInTheDocument();
  });

  it("commits when focus leaves the session through the toolbar's URL row", () => {
    const field = armSummary();
    type(field, "Changed **text**");

    fireEvent.click(within(toolbar()).getByRole("button", { name: "Link" }));
    const href = screen.getByRole("textbox", { name: "Link URL" });
    // Field → toolbar is still the same session; nothing commits yet.
    fireEvent.focusOut(field, { relatedTarget: href });
    expect(writeCount()).toBe(0);

    // Toolbar → outside ends the session: the edit must not stay armed
    // forever with its text never reaching the store.
    fireEvent.focusOut(href, { relatedTarget: document.body });

    expect(store.updateSummary).toHaveBeenCalledExactlyOnceWith("Changed **text**");
    expect(writeCount()).toBe(1);
  });

  it("commits the markdown through updateSummary, once, on blur", () => {
    const field = armSummary();
    type(field, "Rewritten **summary**.");

    blurField(field);

    expect(store.updateSummary).toHaveBeenCalledExactlyOnceWith("Rewritten **summary**.");
    expect(writeCount()).toBe(1);
    expect(screen.queryByTestId("doc-sheet-format-toolbar")).toBeNull();
  });

  it("commits an item's markdown through updateSectionItem", () => {
    render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
    const experience = document.querySelector('[data-section-id="experience"]') as HTMLElement;

    fireEvent.dblClick(within(experience).getAllByTitle("Double-click to edit summary")[0]);
    const field = within(experience).getByRole("textbox", { name: "Summary" });
    type(field, "Shorter summary.");
    blurField(field);

    expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
      summary: "Shorter summary.",
    });
  });

  it("reverts on Escape without writing and closes the toolbar", () => {
    const field = armSummary();
    type(field, "discarded");

    fireEvent.keyDown(field, { key: "Escape" });

    expect(writeCount()).toBe(0);
    expect(screen.queryByTestId("doc-sheet-format-toolbar")).toBeNull();
  });
});
