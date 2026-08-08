import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@solidjs/testing-library";
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

describe("document sheet modal editing (owner decision 2026-08-04)", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
  });

  function renderSheet() {
    return render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
  }

  /**
   * Open the field dialog behind the value `name` — the double-click of the
   * modal editing model — and return the dialog.
   *
   * `scope` narrows the search when the same text is drawn twice — a headline
   * and a job title can read identically.
   */
  function openField(name: string, dialogTitle: string, scope?: HTMLElement): HTMLElement {
    const region = scope ? within(scope) : screen;
    fireEvent.dblClick(region.getByRole("button", { name }));
    return screen.getByRole("dialog", { name: dialogTitle });
  }

  function fieldInput(dialog: HTMLElement, label: string): HTMLInputElement {
    return within(dialog).getByRole("textbox", { name: label }) as HTMLInputElement;
  }

  /** The header region, where the name and headline are drawn. */
  function header(): HTMLElement {
    return screen.getAllByTestId("doc-sheet-header")[0];
  }

  /** The contact block, where email, phone and location are drawn (#794). */
  function contact(): HTMLElement {
    return screen.getAllByTestId("doc-sheet-contact")[0];
  }

  it("draws values as plain content whose only affordance is the tooltip", () => {
    renderSheet();

    const trigger = within(header()).getByRole("button", { name: "Mireille Okafor" });
    expect(trigger).toHaveAttribute("title", "Double-click to edit name");
    // A single pointer click must not open anything.
    fireEvent.click(trigger, { detail: 1 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("double-click opens the typed field dialog — no in-place editor", () => {
    renderSheet();

    const dialog = openField("Mireille Okafor", "Edit · Name", header());
    expect(fieldInput(dialog, "Name").value).toBe("Mireille Okafor");
    // Nothing on the sheet became editable in place.
    expect(document.querySelector("[contenteditable]")).toBeNull();
  });

  it("opens from the keyboard (button activation carries no pointer detail)", () => {
    renderSheet();

    fireEvent.click(within(header()).getByRole("button", { name: "Mireille Okafor" }));
    expect(screen.getByRole("dialog", { name: "Edit · Name" })).toBeInTheDocument();
  });

  it("commits a basics field on Save, through one store action", () => {
    renderSheet();

    const dialog = openField("Mireille Okafor", "Edit · Name", header());
    fireEvent.input(fieldInput(dialog, "Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("name", "Ada Lovelace");
    expect(writeCount()).toBe(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("commits on Enter inside the one-field dialog", () => {
    renderSheet();

    const dialog = openField("Principal Design Systems Engineer", "Edit · Headline", header());
    const input = fieldInput(dialog, "Headline");
    fireEvent.input(input, { target: { value: "Design Systems Lead" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("headline", "Design Systems Lead");
    expect(writeCount()).toBe(1);
  });

  it("discards on Escape without writing — typed content included", () => {
    renderSheet();

    const dialog = openField("mireille@okafor.design", "Edit · Email", contact());
    const input = fieldInput(dialog, "Email");
    fireEvent.input(input, { target: { value: "typo@example.com" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(writeCount()).toBe(0);
    expect(screen.getByRole("button", { name: "mireille@okafor.design" })).toBeInTheDocument();
  });

  it("discards on Cancel without writing", () => {
    renderSheet();

    const dialog = openField("Lisbon, Portugal", "Edit · Location", contact());
    fireEvent.input(fieldInput(dialog, "Location"), { target: { value: "Porto" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(writeCount()).toBe(0);
  });

  it("writes nothing when the text is saved unchanged", () => {
    renderSheet();

    const dialog = openField("Lisbon, Portugal", "Edit · Location", contact());
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(writeCount()).toBe(0);
  });

  it("reseeds the dialog on reopen, so a cancelled draft leaves nothing behind", () => {
    renderSheet();

    let dialog = openField("Lisbon, Portugal", "Edit · Location", contact());
    fireEvent.input(fieldInput(dialog, "Location"), { target: { value: "Porto" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    dialog = openField("Lisbon, Portugal", "Edit · Location", contact());
    expect(fieldInput(dialog, "Location").value).toBe("Lisbon, Portugal");
  });

  it("double-click on an entry opens the item modal pre-filled", () => {
    renderSheet();

    // Entry fields are plain text now; the row itself is the affordance.
    const experience = document.querySelector('[data-section-id="experience"]') as HTMLElement;
    const row = experience.querySelector(".doc-sheet__entry-row") as HTMLElement;
    expect(row).toHaveAttribute("title", "Double-click to edit");
    fireEvent.dblClick(row);

    const dialog = screen.getByRole("dialog", { name: "Edit · Experience" });
    expect(fieldInput(dialog, "Company").value).toBe("Lumen Health");
  });

  it("saves an entry edit through one updateSectionItem call", () => {
    renderSheet();

    const experience = document.querySelector('[data-section-id="experience"]') as HTMLElement;
    fireEvent.dblClick(experience.querySelector(".doc-sheet__entry-row") as HTMLElement);
    const dialog = screen.getByRole("dialog", { name: "Edit · Experience" });
    fireEvent.input(fieldInput(dialog, "Company"), { target: { value: "Lumen Health Group" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(store.updateSectionItem).toHaveBeenCalledOnce();
    const [sectionId, index, updates] = store.updateSectionItem.mock.calls[0] as [
      string,
      number,
      Record<string, unknown>,
    ];
    expect([sectionId, index]).toEqual(["experience", 0]);
    expect(updates.company).toBe("Lumen Health Group");
    expect(writeCount()).toBe(1);
  });

  it("draws rich custom-section items as full entry rows (#821)", () => {
    renderSheet();

    const section = document.querySelector('[data-section-id="speaking"]') as HTMLElement;
    expect(section.querySelector(".doc-sheet__skill-chip")).toBeNull();
    const row = section.querySelector(".doc-sheet__entry") as HTMLElement;
    expect(row.textContent).toContain("Design Tokens Beyond Colour");
    expect(row.textContent).toContain("May 2025");
    expect(row.textContent).toContain("Amsterdam, Netherlands");
    // The markdown summary and the tag chips draw too — the fields the old
    // chip list silently discarded.
    expect(row.textContent).toContain("semantic");
    expect(row.textContent).toContain("Conference Talk");
  });

  it("keeps name-only custom-section items as chips (#794, #821)", () => {
    for (const item of Object.values(resume.sections.custom)) {
      for (const entry of item.items) {
        entry.description = "";
        entry.date = "";
        entry.location = "";
        entry.summary = "";
        entry.keywords = [];
        entry.url = { label: "", href: "" };
      }
    }
    renderSheet();

    expect(screen.queryByRole("button", { name: "Design Tokens Beyond Colour" })).toBeNull();
    const chips = [...document.querySelectorAll(".doc-sheet__skill-chip")].map(
      (chip) => chip.textContent,
    );
    expect(chips.join(" ")).toContain("Design Tokens Beyond Colour");
  });

  it("renames a fixed section through its dialog and updateSectionName", () => {
    renderSheet();

    const dialog = openField("Experience", "Rename section");
    fireEvent.input(fieldInput(dialog, "Section title"), { target: { value: "Work" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(store.updateSectionName).toHaveBeenCalledExactlyOnceWith("experience", "Work");
  });

  it("renames a custom section through updateCustomSection", () => {
    renderSheet();

    const dialog = openField("Talks & Workshops", "Rename section");
    fireEvent.input(fieldInput(dialog, "Section title"), { target: { value: "Talks" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
      name: "Talks",
    });
  });

  it("offers empty core fields as reachable placeholders", () => {
    resume.basics.phone = "";
    renderSheet();

    const dialog = openField("Add phone", "Edit · Phone", contact());
    fireEvent.input(fieldInput(dialog, "Phone"), { target: { value: "+351 000 000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(store.updateBasics).toHaveBeenCalledExactlyOnceWith("phone", "+351 000 000");
  });

  it("keeps a heading's accessible name the value it draws", () => {
    renderSheet();

    // The trigger must not rename the heading it sits inside — an
    // `aria-label` here would make every heading announce "Edit …".
    expect(screen.getByRole("heading", { name: "Mireille Okafor" })).toBeInTheDocument();
  });
});

describe("summary markdown dialog", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
  });

  /** Open the summary's markdown dialog via double-click on the body. */
  function openSummary(): HTMLElement {
    render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} />);
    const summary = document.querySelector('[data-section-id="summary"]') as HTMLElement;
    fireEvent.dblClick(within(summary).getByTitle("Double-click to edit summary"));
    return screen.getByRole("dialog", { name: "Edit · Summary" });
  }

  function editor(dialog: HTMLElement): HTMLTextAreaElement {
    return within(dialog).getByRole("textbox", { name: "Summary" }) as HTMLTextAreaElement;
  }

  it("opens a full markdown editor seeded with the raw markdown", () => {
    const dialog = openSummary();

    expect(editor(dialog).value).toBe(resume.sections.summary.content);
    // The full toolbar, no underline/strikethrough — markdown has neither.
    expect(within(dialog).getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Italic" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Link" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Bulleted list" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Numbered list" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /underline/i })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /strike/i })).toBeNull();
  });

  it("applies a toolbar command to the draft's selection", () => {
    const dialog = openSummary();
    const textarea = editor(dialog);
    fireEvent.input(textarea, { target: { value: "text" } });
    textarea.setSelectionRange(0, 4);

    fireEvent.click(within(dialog).getByRole("button", { name: "Bold" }));

    expect(textarea.value).toBe("**text**");
    // Still a draft: nothing reaches the store until Save.
    expect(writeCount()).toBe(0);
  });

  it("emits a markdown link from the URL row — no prompt anywhere", () => {
    const dialog = openSummary();
    const textarea = editor(dialog);
    fireEvent.input(textarea, { target: { value: "Halo guide" } });
    textarea.setSelectionRange(0, 10);

    fireEvent.click(within(dialog).getByRole("button", { name: "Link" }));
    const href = within(dialog).getByRole("textbox", { name: "Link URL" });
    fireEvent.input(href, { target: { value: "https://halo.example" } });
    fireEvent.keyDown(href, { key: "Enter" });

    expect(textarea.value).toBe("[Halo guide](https://halo.example)");
  });

  it("commits the markdown through updateSummary, once, on Save", () => {
    const dialog = openSummary();
    fireEvent.input(editor(dialog), { target: { value: "Rewritten **summary**." } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(store.updateSummary).toHaveBeenCalledExactlyOnceWith("Rewritten **summary**.");
    expect(writeCount()).toBe(1);
  });

  it("discards on Escape without writing", () => {
    const dialog = openSummary();
    const textarea = editor(dialog);
    fireEvent.input(textarea, { target: { value: "discarded" } });

    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(writeCount()).toBe(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
