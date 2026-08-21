/**
 * The structural chrome of #794: universal section cards with a grip and a
 * pencil menu, entry rows with the hover action pill, dashed add-blocks, and
 * the page-break rule.
 *
 * Pointer drags themselves are exercised against the pure resolvers in
 * `lib/__tests__/docDnd.test.ts`; here the assertions are that every control
 * routes to exactly the right store action — one action per operation — and
 * that moves are announced.
 */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { entryStep } from "../../../lib/docDnd";
import {
  loadDocEditorFixture,
  SIDEBAR_TEMPLATE,
  SINGLE_TEMPLATE,
} from "../../../test/docEditorFixture";
import { bundledTemplateLayout, docFontStack, type TemplateLayout } from "../../../lib/docLayout";
import { DocSheet } from "../DocSheet";
import type { ResumeData } from "../../../wasm/types";

const store = vi.hoisted(() => ({
  store: { resume: null as unknown },
  updateBasics: vi.fn(),
  updateSummary: vi.fn(),
  updateCoverLetter: vi.fn(),
  updateSectionName: vi.fn(),
  updateSectionItem: vi.fn(),
  addSectionItem: vi.fn(),
  removeSectionItem: vi.fn(),
  reorderSectionItem: vi.fn(),
  duplicateSectionItem: vi.fn(),
  toggleSectionVisibility: vi.fn(),
  updateCustomSection: vi.fn(),
  addCustomSection: vi.fn(() => "custom-1"),
  removeCustomSection: vi.fn(),
  addCustomSectionItem: vi.fn(),
  updateCustomSectionItem: vi.fn(),
  removeCustomSectionItem: vi.fn(),
  reorderCustomSectionItem: vi.fn(),
  duplicateCustomSectionItem: vi.fn(),
  updateLayout: vi.fn(),
  updatePagination: vi.fn(),
  updateMetadata: vi.fn(),
}));

vi.mock("../../../stores/resume", () => ({ resumeStore: store }));

/** Total writes recorded across every mocked store action. */
function writeCount(): number {
  return Object.entries(store)
    .filter(([key]) => key !== "store")
    .reduce((total, [, action]) => total + (action as Mock).mock.calls.length, 0);
}

function liveRegionText(): string {
  return [...document.querySelectorAll('[aria-live="polite"]')]
    .map((element) => element.textContent)
    .join(" ");
}

/** Open a section's pencil menu, the home of its structural actions. */
function openMenu(title: string): void {
  fireEvent.click(screen.getByRole("button", { name: `${title} section options` }));
}

/**
 * The fixture's first experience entry as the chrome names it — the position,
 * per the headline-field preference order.
 */
const FIRST_EXPERIENCE = "Principal Design Systems Engineer";

interface MockDataTransfer {
  data: Record<string, string>;
  setData: (mime: string, value: string) => void;
  getData: (mime: string) => string;
  effectAllowed: string;
  dropEffect: string;
}

function mockDataTransfer(): MockDataTransfer {
  const data: Record<string, string> = {};
  return {
    data,
    setData: (mime, value) => {
      data[mime] = value;
    },
    getData: (mime) => data[mime] ?? "",
    effectAllowed: "",
    dropEffect: "",
  };
}

function sectionCard(sectionId: string): HTMLElement {
  const card = document.querySelector(`[data-section-id="${sectionId}"]`);
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function entryRow(itemId: string): HTMLElement {
  const row = document.querySelector(`[data-entry-id="${itemId}"]`);
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

describe("document sheet structural chrome", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
    store.store.resume = resume;
  });

  function renderSheet(
    options: {
      onOpenSections?: () => void;
      template?: TemplateLayout;
      mode?: "edit" | "done";
    } = {},
  ) {
    return render(() => (
      <DocSheet
        resume={resume}
        templateLayout={options.template ?? SIDEBAR_TEMPLATE}
        onOpenSections={options.onOpenSections}
        mode={options.mode}
      />
    ));
  }

  describe("avatar (#857)", () => {
    const photoUrl = "data:image/png;base64,AAA";

    it("shows the photo in Done mode when a photo is set and shown", () => {
      resume.basics.picture.url = photoUrl;
      resume.basics.picture.effects.hidden = false;
      renderSheet({ mode: "done" });

      const sheet = screen.getByTestId("doc-sheet");
      expect(within(sheet).getByAltText("Profile picture of Mireille Okafor")).toBeInTheDocument();
      expect(sheet.querySelector(".doc-sheet__avatar-initials")).toBeNull();
    });

    it("collapses the slot in Done mode when a set photo is hidden", () => {
      resume.basics.picture.url = photoUrl;
      resume.basics.picture.effects.hidden = true;
      resume.basics.picture.effects.showInitials = true;
      renderSheet({ mode: "done" });

      const sheet = screen.getByTestId("doc-sheet");
      expect(sheet.querySelector(".doc-sheet__avatar-btn")).toBeNull();
      expect(sheet.querySelector(".doc-sheet__avatar-initials")).toBeNull();
      expect(within(sheet).queryByAltText(/Profile picture/)).toBeNull();
    });

    it("collapses the slot in Done mode when no photo is set", () => {
      renderSheet({ mode: "done" });

      const sheet = screen.getByTestId("doc-sheet");
      expect(sheet.querySelector(".doc-sheet__avatar-btn")).toBeNull();
      expect(sheet.querySelector(".doc-sheet__avatar-initials")).toBeNull();
    });

    it("draws the initials disc in Done mode when opted in without a photo", () => {
      resume.basics.picture.effects.showInitials = true;
      renderSheet({ mode: "done" });

      const sheet = screen.getByTestId("doc-sheet");
      const initials = sheet.querySelector(".doc-sheet__avatar-initials");
      expect(initials).not.toBeNull();
      expect(initials?.textContent).toBe("MO");
      expect(within(sheet).queryByRole("button")).toBeNull();
    });

    it("keeps a photo-dialog affordance in edit mode when the slot is collapsed", () => {
      renderSheet({ mode: "edit" });

      const button = screen.getByRole("button", { name: "Add profile photo" });
      expect(button.querySelector(".doc-sheet__avatar-placeholder")).not.toBeNull();
      expect(button.querySelector(".doc-sheet__avatar-initials")).toBeNull();
    });
  });

  describe("level indicator (#829)", () => {
    it("hides dots when a fractional level clamps to 0", () => {
      resume.sections.languages.items[0].level = 0.4;
      renderSheet();

      expect(entryRow("lang-1").querySelector(".doc-sheet__lang-dots")).toBeNull();
    });
  });

  describe("sheet typography (#828)", () => {
    it("scopes document faces on the sheet root, not app chrome --font-*", () => {
      renderSheet();

      const sheet = screen.getByTestId("doc-sheet");
      const body = sheet.style.getPropertyValue("--doc-font-body");
      const display = sheet.style.getPropertyValue("--doc-font-display");
      expect(body).toBe(docFontStack("ibm-plex-sans"));
      expect(display).toBe(docFontStack("ibm-plex-sans"));
      // Must not inherit / re-expose the app chrome tokens.
      expect(sheet.style.getPropertyValue("--font-body")).toBe("");
      expect(body).not.toContain("Source Serif");
      expect(body).not.toContain("Fraunces");
    });

    it("follows nosepass chrome with IBM Plex Serif", () => {
      resume.metadata.template = "nosepass";
      const layout = bundledTemplateLayout("nosepass");
      renderSheet({ template: layout });

      const sheet = screen.getByTestId("doc-sheet");
      const expected = docFontStack(layout.fontBody);
      expect(sheet.style.getPropertyValue("--doc-font-body")).toBe(expected);
      expect(sheet.style.getPropertyValue("--doc-font-display")).toBe(expected);
      expect(expected).toContain("IBM Plex Serif");
    });

    it("follows glalie chrome with IBM Plex Sans (Typst still inherits engine serif)", () => {
      resume.metadata.template = "glalie";
      const layout = bundledTemplateLayout("glalie");
      renderSheet({ template: layout });

      const sheet = screen.getByTestId("doc-sheet");
      const expected = docFontStack(layout.fontBody);
      expect(sheet.style.getPropertyValue("--doc-font-body")).toBe(expected);
      expect(sheet.style.getPropertyValue("--doc-font-display")).toBe(expected);
      expect(expected).toContain("IBM Plex Sans");
    });
  });

  describe("Done-mode PDF fidelity (#860)", () => {
    function eduDate(sheet: HTMLElement): HTMLElement {
      const date = sheet.querySelector<HTMLElement>(".doc-sheet__edu-date");
      expect(date, "expected an education date").not.toBeNull();
      return date!;
    }

    it("justifies glalie body text in Done mode", () => {
      resume.metadata.template = "glalie";
      renderSheet({ template: bundledTemplateLayout("glalie"), mode: "done" });

      const sheet = screen.getByTestId("doc-sheet");
      expect(sheet.className).toContain("doc-sheet--tpl-glalie");
      expect(sheet.classList.contains("doc-sheet--justify-body")).toBe(true);
      expect(sheet).toHaveAttribute("data-sheet-mode", "done");
      expect(sheet.querySelector(".doc-sheet__summary")).not.toBeNull();
    });

    it("leaves other templates' Done-mode body start-aligned", () => {
      for (const id of ["onyx", "gengar", "rhyhorn"] as const) {
        resume.metadata.template = id;
        const { unmount } = renderSheet({
          template: bundledTemplateLayout(id),
          mode: "done",
        });
        const sheets = screen.getAllByTestId("doc-sheet");
        const sheet = sheets[sheets.length - 1];
        expect(sheet.className).toContain(`doc-sheet--tpl-${id}`);
        expect(sheet.classList.contains("doc-sheet--justify-body")).toBe(false);
        unmount();
      }
    });

    it("uses the muted body face for education dates in Done mode", () => {
      resume.metadata.template = "glalie";
      renderSheet({ template: bundledTemplateLayout("glalie"), mode: "done" });

      const sheet = screen.getByTestId("doc-sheet");
      const date = eduDate(sheet);
      expect(date.classList.contains("doc-sheet__edu-date--body")).toBe(true);
    });

    it("keeps education dates mono in edit mode", () => {
      resume.metadata.template = "glalie";
      renderSheet({ template: bundledTemplateLayout("glalie"), mode: "edit" });

      const sheet = screen.getByTestId("doc-sheet");
      expect(sheet).toHaveAttribute("data-sheet-mode", "edit");
      const date = eduDate(sheet);
      expect(date.classList.contains("doc-sheet__edu-date--body")).toBe(false);
      expect(date.className).toContain("doc-sheet__edu-date");
    });
  });

  describe("section cards", () => {
    it("hides a fixed section through toggleSectionVisibility, and says so", async () => {
      renderSheet();

      openMenu("Experience");
      fireEvent.click(screen.getByRole("menuitem", { name: "Hide Experience section" }));

      expect(store.toggleSectionVisibility).toHaveBeenCalledExactlyOnceWith("experience");
      expect(writeCount()).toBe(1);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(/Experience section hidden/i);
      });
    });

    it("hides a custom section through updateCustomSection", () => {
      renderSheet();

      openMenu("Talks & Workshops");
      fireEvent.click(screen.getByRole("menuitem", { name: "Hide Talks & Workshops section" }));

      expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
        visible: false,
      });
    });

    it("never draws a hidden section — the Sections panel is the recovery path", () => {
      resume.sections.experience.visible = false;
      renderSheet();

      expect(document.querySelector('[data-section-id="experience"]')).toBeNull();
    });

    it("offers no destructive delete for any section, custom included", () => {
      renderSheet();

      openMenu("Talks & Workshops");
      expect(
        screen.queryByRole("menuitem", { name: "Delete Talks & Workshops section" }),
      ).toBeNull();
      expect(screen.queryByRole("menuitem", { name: "Delete Experience section" })).toBeNull();
    });

    it("renames a section from the pencil menu through the rename dialog", () => {
      renderSheet();

      openMenu("Talks & Workshops");
      fireEvent.click(screen.getByRole("menuitem", { name: "Rename Talks & Workshops section" }));
      const dialog = screen.getByRole("dialog", { name: "Rename section" });
      fireEvent.input(within(dialog).getByRole("textbox", { name: "Section title" }), {
        target: { value: "Talks" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
        name: "Talks",
      });
    });

    it("closes the pencil menu on Escape without acting", () => {
      renderSheet();

      openMenu("Experience");
      expect(screen.getByRole("menu", { name: "Experience section options" })).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("menu", { name: "Experience section options" })).toBeNull();
      expect(writeCount()).toBe(0);
    });

    it("marks the last-clicked card focused", () => {
      renderSheet();

      const experience = document.querySelector('[data-section-id="experience"]') as HTMLElement;
      fireEvent.click(experience);

      expect(experience.classList.contains("doc-sheet__sec--focused")).toBe(true);
    });
  });

  describe("section move controls", () => {
    it("moves a section one step down through one updateLayout call", () => {
      renderSheet();

      openMenu("Experience");
      fireEvent.click(screen.getByRole("menuitem", { name: "Move Experience section down" }));

      expect(store.updateLayout).toHaveBeenCalledExactlyOnceWith([
        [
          ["summary", "education", "experience", "projects"],
          ["profiles", "skills", "speaking"],
        ],
        [
          ["publications", "volunteer", "awards"],
          ["languages", "interests", "certifications", "advisory"],
        ],
      ]);
      expect(writeCount()).toBe(1);
    });

    it("moves a section to the other column's end", () => {
      renderSheet();

      openMenu("Talks & Workshops");
      fireEvent.click(
        screen.getByRole("menuitem", {
          name: "Move Talks & Workshops section to the main column",
        }),
      );

      const [layout] = store.updateLayout.mock.calls[0] as [string[][][]];
      expect(layout[0][1]).toEqual(["profiles", "skills"]);
      expect(layout[0][0]).toEqual(["summary", "experience", "education", "projects", "speaking"]);
    });

    it("announces the move in drawn-card terms", async () => {
      renderSheet();

      openMenu("Experience");
      fireEvent.click(screen.getByRole("menuitem", { name: "Move Experience section down" }));

      await waitFor(() => {
        expect(liveRegionText()).toMatch(
          /Experience section moved to position 3 of 4 in column 2 of page 1/i,
        );
      });
    });

    it("hands focus back to the card's pencil after a menu move", async () => {
      renderSheet();

      openMenu("Experience");
      fireEvent.click(screen.getByRole("menuitem", { name: "Move Experience section down" }));

      // The menu has closed; a keyboard user's next Tab must carry on from
      // the card that was acted on, not restart at the top of the document.
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "Experience section options" }),
        ),
      );
    });

    it("steps past a placed-but-undrawn section, and counts only drawn cards", async () => {
      // `education` keeps its layout slot but is hidden, so one press on
      // Experience must clear it in a single visible step — and the announced
      // position must match the three cards on screen, not the four slots in
      // the layout.
      resume.sections.education.visible = false;
      renderSheet();

      openMenu("Experience");
      fireEvent.click(screen.getByRole("menuitem", { name: "Move Experience section down" }));

      const [layout] = store.updateLayout.mock.calls[0] as [string[][][]];
      expect(layout[0][0]).toEqual(["summary", "education", "projects", "experience"]);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(
          /Experience section moved to position 3 of 3 in column 2 of page 1/i,
        );
      });
    });

    it("disables the move at a boundary, so nothing is written", () => {
      renderSheet();

      openMenu("Summary");
      const control = screen.getByRole("menuitem", { name: "Move Summary section up" });
      expect(control).toBeDisabled();

      fireEvent.click(control);

      expect(store.updateLayout).not.toHaveBeenCalled();
      expect(writeCount()).toBe(0);
    });
  });

  describe("entry actions", () => {
    it("duplicates an entry through duplicateSectionItem", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: `Duplicate ${FIRST_EXPERIENCE}` }));

      expect(store.duplicateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0);
      expect(writeCount()).toBe(1);
    });

    it("removes the right entry through removeSectionItem, and says so", async () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: `Remove ${FIRST_EXPERIENCE}` }));

      expect(store.removeSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(/Principal Design Systems Engineer removed/i);
      });
    });

    it("hides an entry, keeps it drawn, and can show it again", () => {
      const first = renderSheet();
      fireEvent.click(screen.getByRole("button", { name: `Hide ${FIRST_EXPERIENCE}` }));
      expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
        visible: false,
      });

      // Redraw with the item actually hidden: still present, now as chrome.
      // Unmounted first, so the queries below see exactly one sheet.
      first.unmount();
      resume.sections.experience.items[0].visible = false;
      vi.clearAllMocks();
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: `Show ${FIRST_EXPERIENCE}` }));
      expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
        visible: true,
      });
    });

    it("removes a custom entry through its chip, with no dialog round-trip", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Remove Design Tokens Beyond Colour" }));

      expect(store.removeCustomSectionItem).toHaveBeenCalledExactlyOnceWith("speaking", 0);
      expect(writeCount()).toBe(1);
    });

    it("opens the item modal from a custom entry's chip name", () => {
      // Chips render outside SortableEntry, so the name itself must be the
      // edit path — without it, existing custom entries cannot be edited.
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Edit Design Tokens Beyond Colour" }));

      expect(screen.getByRole("dialog", { name: /^Edit · / })).toBeInTheDocument();
      expect(writeCount()).toBe(0);
    });

    it("opens the item modal from an interest's name", () => {
      // Interests render as a plain list outside SortableEntry; the name is
      // their edit path.
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Edit Letterpress printing" }));

      expect(screen.getByRole("dialog", { name: /^Edit · Interests/ })).toBeInTheDocument();
      expect(writeCount()).toBe(0);
    });
  });

  describe("entry move controls", () => {
    it("reorders within the section through one reorderSectionItem call", async () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: `Move ${FIRST_EXPERIENCE} down` }));

      expect(store.reorderSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, 1);
      expect(writeCount()).toBe(1);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(
          /Principal Design Systems Engineer moved to position 2 of \d+/i,
        );
      });
    });

    it("performs the same mutation as the equivalent drag would", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: `Move ${FIRST_EXPERIENCE} down` }));

      // The drag path resolves through `entryStep` to a (from, to) pair; the
      // control must hand the store the identical pair.
      const items = resume.sections.experience.items.map(({ id, visible }) => ({ id, visible }));
      const expected = entryStep(items, items[0].id, "down");
      expect(expected).not.toBeNull();
      expect(store.reorderSectionItem).toHaveBeenCalledExactlyOnceWith(
        "experience",
        expected!.fromIndex,
        expected!.toIndex,
      );
    });

    it("draws no move control at a boundary — the pill has no dead arrows", () => {
      renderSheet();

      // The first entry has no neighbour above; per spec §1.9 the arrow is
      // rendered only when a neighbour exists in that direction.
      expect(screen.queryByRole("button", { name: `Move ${FIRST_EXPERIENCE} up` })).toBeNull();
      expect(writeCount()).toBe(0);
    });
  });

  describe("add-blocks", () => {
    it("offers a placed-but-empty section as an add affordance", () => {
      resume.sections.projects.items = [];
      renderSheet();

      const projects = document.querySelector('[data-section-id="projects"]') as HTMLElement;
      expect(within(projects).getByText("No items yet — use + to add one.")).toBeInTheDocument();

      fireEvent.click(within(projects).getByRole("button", { name: "Add project" }));
      // Scoped to the dialog: the add-block trigger shares the same name.
      const dialog = screen.getByRole("dialog");
      fireEvent.input(within(dialog).getByRole("textbox", { name: "Name" }), {
        target: { value: "Halo" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));

      expect(store.addSectionItem).toHaveBeenCalledOnce();
      const [sectionId, item] = store.addSectionItem.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(sectionId).toBe("projects");
      expect(item.name).toBe("Halo");
      expect(item.visible).toBe(true);
    });

    it("draws a dashed add-block under every item section", () => {
      renderSheet();

      const experience = document.querySelector('[data-section-id="experience"]') as HTMLElement;
      expect(within(experience).getByRole("button", { name: "Add experience" })).toHaveClass(
        "doc-sheet__add-block",
      );
      // Rich text takes no items, so it gets no add-block.
      const summary = document.querySelector('[data-section-id="summary"]') as HTMLElement;
      expect(within(summary).queryByRole("button", { name: /^Add / })).toBeNull();
    });

    it("routes the end-of-column Add-section block to the Sections panel", () => {
      const onOpenSections = vi.fn();
      renderSheet({ onOpenSections });

      fireEvent.click(screen.getAllByTestId("doc-sheet-add-section")[0]);

      expect(onOpenSections).toHaveBeenCalledOnce();
      expect(writeCount()).toBe(0);
    });

    it("falls back to the custom-section dialog when no panel is wired", () => {
      renderSheet();

      fireEvent.click(screen.getAllByTestId("doc-sheet-add-section")[0]);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("page breaks", () => {
    it("labels the rule between explicit pages", () => {
      renderSheet();

      const rule = screen.getByTestId("doc-sheet-page-break");
      expect(rule).toHaveTextContent("Page 2");
    });

    it("merges the page into the one before it through one updateLayout call", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Remove page break" }));

      expect(store.updateLayout).toHaveBeenCalledExactlyOnceWith([
        [
          ["summary", "experience", "education", "projects", "publications", "volunteer", "awards"],
          [
            "profiles",
            "skills",
            "speaking",
            "languages",
            "interests",
            "certifications",
            "advisory",
          ],
        ],
      ]);
      expect(writeCount()).toBe(1);
    });
  });

  describe("whole-surface drag and drop", () => {
    it("makes the whole row and the whole card drag surfaces, grips included", () => {
      renderSheet();

      expect(sectionCard("experience").getAttribute("draggable")).toBe("true");
      expect(entryRow("exp-1").getAttribute("draggable")).toBe("true");
      // The grips remain as visible affordances with their own drag wiring.
      expect(screen.getByTitle("Drag Experience section to move it")).toBeInTheDocument();
      expect(screen.getByTitle(`Drag ${FIRST_EXPERIENCE} to move it`)).toBeInTheDocument();
    });

    it("carries the spec MIME payload and mirrors the drag in row styling", () => {
      renderSheet();
      const row = entryRow("exp-1");
      const dataTransfer = mockDataTransfer();

      fireEvent.mouseDown(row);
      fireEvent.dragStart(row, { dataTransfer });

      expect(JSON.parse(dataTransfer.data["application/x-entry"])).toEqual({
        sectionId: "experience",
        id: "exp-1",
      });
      expect(dataTransfer.effectAllowed).toBe("move");
      expect(row.classList.contains("doc-sheet__entry-row--dragging")).toBe(true);
    });

    it("vetoes a row drag that began on a control, in dragstart not mousedown", () => {
      renderSheet();
      const row = entryRow("exp-1");
      const control = within(row).getByRole("button", { name: `Edit ${FIRST_EXPERIENCE}` });
      const dataTransfer = mockDataTransfer();

      fireEvent.mouseDown(control);
      const proceeded = fireEvent.dragStart(row, { dataTransfer });

      // fireEvent returns false when the handler called preventDefault.
      expect(proceeded).toBe(false);
      expect(dataTransfer.data["application/x-entry"]).toBeUndefined();
    });

    it("reorders an entry within its section from a whole-row drag", () => {
      renderSheet();
      const source = entryRow("exp-2");
      const target = entryRow("exp-1");
      const dataTransfer = mockDataTransfer();

      fireEvent.mouseDown(source);
      fireEvent.dragStart(source, { dataTransfer });
      fireEvent.dragEnter(target, { dataTransfer, clientY: 0 });
      fireEvent.dragOver(target, { dataTransfer, clientY: 0 });
      // A 3px slot bar marks the insert position on the target row.
      expect(target.querySelector(".doc-sheet__entry-slot--before")).not.toBeNull();
      fireEvent.drop(target, { dataTransfer, clientY: 0 });

      expect(store.reorderSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 1, 0);
      expect(writeCount()).toBe(1);
      // Drag state is cleared on drop.
      expect(document.querySelector(".doc-sheet__entry-slot--before")).toBeNull();
    });

    it("inserts after the target when dropped in its bottom half", () => {
      renderSheet();
      const source = entryRow("exp-1");
      const target = entryRow("exp-3");
      // jsdom rects are all zero, and jsdom has no DragEvent, so fireEvent's
      // drag events fall back to plain Event and cannot carry clientY. Give
      // the target a real box and dispatch MouseEvent-based drag events so a
      // pointer below the midpoint exercises the +1 branch of
      // dropIndexFromPointer.
      target.getBoundingClientRect = () =>
        ({ top: 100, bottom: 140, height: 40, left: 0, right: 400, width: 400 }) as DOMRect;
      const dataTransfer = mockDataTransfer();
      const dragEventAt = (type: string, clientY: number): MouseEvent => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
        Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
        return event;
      };

      fireEvent.mouseDown(source);
      fireEvent.dragStart(source, { dataTransfer });
      target.dispatchEvent(dragEventAt("dragover", 135));
      // Bottom half of the last row -> the after-slot marks "insert last".
      expect(target.querySelector(".doc-sheet__entry-slot--after")).not.toBeNull();
      target.dispatchEvent(dragEventAt("drop", 135));

      expect(store.reorderSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, 2);
      expect(writeCount()).toBe(1);
    });

    it("rejects cross-section item drops — same-section-only by decision", () => {
      renderSheet();
      const source = entryRow("exp-1");
      const target = entryRow("edu-1");
      const dataTransfer = mockDataTransfer();

      fireEvent.mouseDown(source);
      fireEvent.dragStart(source, { dataTransfer });
      fireEvent.dragEnter(target, { dataTransfer, clientY: 0 });
      fireEvent.dragOver(target, { dataTransfer, clientY: 0 });
      fireEvent.drop(target, { dataTransfer, clientY: 0 });

      expect(target.querySelector(".doc-sheet__entry-slot--before")).toBeNull();
      expect(writeCount()).toBe(0);
    });

    it("moves a section dropped on another card, with a slot indicator", () => {
      renderSheet();
      const source = sectionCard("education");
      const target = sectionCard("experience");
      const dataTransfer = mockDataTransfer();

      fireEvent.mouseDown(source);
      fireEvent.dragStart(source, { dataTransfer });
      expect(JSON.parse(dataTransfer.data["application/x-section"])).toEqual({
        id: "education",
      });
      expect(source.classList.contains("doc-sheet__sec--dragging")).toBe(true);

      fireEvent.dragEnter(target, { dataTransfer, clientY: 0 });
      fireEvent.dragOver(target, { dataTransfer, clientY: 0 });
      expect(target.querySelector(".doc-sheet__sec-slot--before")).not.toBeNull();
      fireEvent.drop(target, { dataTransfer, clientY: 0 });

      expect(store.updateLayout).toHaveBeenCalledExactlyOnceWith([
        [
          ["summary", "education", "experience", "projects"],
          ["profiles", "skills", "speaking"],
        ],
        [
          ["publications", "volunteer", "awards"],
          ["languages", "interests", "certifications", "advisory"],
        ],
      ]);
      expect(writeCount()).toBe(1);
    });

    it("vetoes a card drag that began on an entry row — the row owns it", () => {
      renderSheet();
      const card = sectionCard("experience");
      const dataTransfer = mockDataTransfer();

      fireEvent.mouseDown(entryRow("exp-1"));
      const proceeded = fireEvent.dragStart(card, { dataTransfer });

      expect(proceeded).toBe(false);
      expect(dataTransfer.data["application/x-section"]).toBeUndefined();
    });

    it("accepts the Add-section block as the end-of-column drop target", () => {
      renderSheet();
      const source = sectionCard("experience");
      // Sidebar-left template: the sidebar column renders first on the page.
      const [sidebarBlock] = screen.getAllByTestId("doc-sheet-add-section");
      const dataTransfer = mockDataTransfer();

      fireEvent.mouseDown(source);
      fireEvent.dragStart(source, { dataTransfer });
      fireEvent.dragEnter(sidebarBlock, { dataTransfer });
      fireEvent.dragOver(sidebarBlock, { dataTransfer });
      expect(sidebarBlock.classList.contains("doc-sheet__add-section-block--drop-hint")).toBe(true);
      fireEvent.drop(sidebarBlock, { dataTransfer });

      const [layout] = store.updateLayout.mock.calls[0] as [string[][][]];
      expect(layout[0][0]).toEqual(["summary", "education", "projects"]);
      expect(layout[0][1]).toEqual(["profiles", "skills", "speaking", "experience"]);
      expect(writeCount()).toBe(1);
    });

    it("gives the basics contact block no grip, menu, or drag chrome", () => {
      renderSheet();

      const contact = document.querySelector('[data-section-id="basics"]');
      expect(contact).not.toBeNull();
      expect(contact?.querySelector(".doc-sheet__sec-grip")).toBeNull();
      expect(contact?.querySelector(".doc-sheet__sec-pencil")).toBeNull();
    });
  });

  describe("explicit pagination (#796)", () => {
    it("draws item-break continuation slices with a (cont.) title", () => {
      resume.metadata.itemBreaks = { experience: ["exp-2"] };
      renderSheet({ template: SINGLE_TEMPLATE });

      const cards = [...document.querySelectorAll('[data-section-id="experience"]')];
      expect(cards).toHaveLength(2);
      expect(cards[0].querySelector(".doc-sheet__sec-title")?.textContent).toBe("Experience");
      expect(cards[1].querySelector(".doc-sheet__sec-title")?.textContent).toBe(
        "Experience (cont.)",
      );
      // Slice 0 holds the item before the marker; the continuation the rest.
      expect(cards[0].querySelector('[data-entry-id="exp-1"]')).not.toBeNull();
      expect(cards[0].querySelector('[data-entry-id="exp-2"]')).toBeNull();
      expect(cards[1].querySelector('[data-entry-id="exp-2"]')).not.toBeNull();
      expect(cards[1].querySelector('[data-entry-id="exp-3"]')).not.toBeNull();
      // The add affordance lives only on the last slice (spec 2.6).
      expect(cards[0].querySelector(".doc-sheet__add-block")).toBeNull();
      expect(cards[1].querySelector(".doc-sheet__add-block")).not.toBeNull();
    });

    it("offers no insert-break menu action on a continuation slice", () => {
      resume.metadata.itemBreaks = { experience: ["exp-2"] };
      renderSheet({ template: SINGLE_TEMPLATE });

      // A continuation has no raw placement of its own — the action would
      // split before the whole section, not the "(cont.)" card it names.
      fireEvent.click(screen.getByRole("button", { name: "Experience (cont.) section options" }));
      expect(screen.queryByRole("menuitem", { name: /Insert page break before/ })).toBeNull();
    });

    it("leaves markers inert on templates whose layout cannot honor them", () => {
      resume.metadata.itemBreaks = { experience: ["exp-2"] };
      renderSheet({ template: SIDEBAR_TEMPLATE });

      expect(document.querySelectorAll('[data-section-id="experience"]')).toHaveLength(1);
    });

    it("prefers clearing the item break when removing the page break rule", () => {
      resume.metadata.itemBreaks = { experience: ["exp-2"] };
      renderSheet({ template: SINGLE_TEMPLATE });

      const [removeButton] = screen.getAllByRole("button", { name: "Remove page break" });
      fireEvent.click(removeButton);

      expect(store.updateMetadata).toHaveBeenCalledExactlyOnceWith("itemBreaks", {});
      expect(store.updateLayout).not.toHaveBeenCalled();
      expect(writeCount()).toBe(1);
    });

    it("falls back to merging the raw pages when no item break spans the rule", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Remove page break" }));

      expect(store.updateLayout).toHaveBeenCalledExactlyOnceWith([
        [
          ["summary", "experience", "education", "projects", "publications", "volunteer", "awards"],
          [
            "profiles",
            "skills",
            "speaking",
            "languages",
            "interests",
            "certifications",
            "advisory",
          ],
        ],
      ]);
      expect(writeCount()).toBe(1);
    });

    it("inserts an item break from the entry pill on a single-flow template", () => {
      renderSheet({ template: SINGLE_TEMPLATE });

      fireEvent.click(
        screen.getByRole("button", {
          name: "Insert page break before Senior Frontend Engineer",
        }),
      );

      expect(store.updateMetadata).toHaveBeenCalledExactlyOnceWith("itemBreaks", {
        experience: ["exp-2"],
      });
      expect(writeCount()).toBe(1);
    });

    it("greys the pill action out with a reason on the section's first item", () => {
      renderSheet({ template: SINGLE_TEMPLATE });

      const button = screen.getByRole("button", {
        name: `Insert page break before ${FIRST_EXPERIENCE}`,
      });
      fireEvent.click(button);

      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(writeCount()).toBe(0);
    });

    it("greys the pill action out with the template tooltip on column layouts", () => {
      renderSheet({ template: SIDEBAR_TEMPLATE });

      const button = screen.getByRole("button", {
        name: "Insert page break before Senior Frontend Engineer",
      });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      // The reason is a tooltip wired through aria-describedby, reachable on
      // keyboard focus as well as hover (owner decision 2026-08-03).
      const tooltipId = button.getAttribute("aria-describedby");
      expect(tooltipId).not.toBeNull();
      const tooltip = document.getElementById(tooltipId as string);
      expect(tooltip?.getAttribute("role")).toBe("tooltip");
      expect(tooltip?.textContent).toMatch(/single-flow templates/i);

      fireEvent.click(button);
      expect(writeCount()).toBe(0);
    });

    it("splits the layout from the pencil menu's insert-break action", () => {
      renderSheet();

      openMenu("Education");
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Insert page break before Education section" }),
      );

      expect(store.updateLayout).toHaveBeenCalledExactlyOnceWith([
        [
          ["summary", "experience"],
          ["profiles", "skills", "speaking"],
        ],
        [["education", "projects"], []],
        [
          ["publications", "volunteer", "awards"],
          ["languages", "interests", "certifications", "advisory"],
        ],
      ]);
      expect(writeCount()).toBe(1);
    });

    it("disables the pencil insert-break action when the split changes nothing", () => {
      // A section already at the very top of a page with nothing beside it:
      // splitting before it reproduces the same page stack.
      resume.metadata.layout = [[["summary", "experience", "education"]]];
      renderSheet({ template: SINGLE_TEMPLATE });

      openMenu("Summary");
      const item = screen.getByRole("menuitem", {
        name: "Insert page break before Summary section",
      });
      expect((item as HTMLButtonElement).disabled).toBe(true);

      // The same action is live for a section with content above it.
      fireEvent.keyDown(document, { key: "Escape" });
      openMenu("Experience");
      const enabled = screen.getByRole("menuitem", {
        name: "Insert page break before Experience section",
      });
      expect((enabled as HTMLButtonElement).disabled).toBe(false);
    });

    it("drops a moved section's item breaks in the same pagination write", () => {
      resume.metadata.itemBreaks = { experience: ["exp-2"] };
      renderSheet({ template: SINGLE_TEMPLATE });

      const source = sectionCard("experience");
      const target = sectionCard("projects");
      const dataTransfer = mockDataTransfer();
      fireEvent.mouseDown(source);
      fireEvent.dragStart(source, { dataTransfer });
      fireEvent.dragEnter(target, { dataTransfer, clientY: 0 });
      fireEvent.drop(target, { dataTransfer, clientY: 0 });

      // One combined write: the new layout and the cleared breaks together
      // (spec 2.5 - a whole-section move invalidates its mid-section breaks).
      expect(store.updateLayout).not.toHaveBeenCalled();
      expect(store.updatePagination).toHaveBeenCalledOnce();
      const [layout, breaks] = store.updatePagination.mock.calls[0] as [
        string[][][],
        Record<string, string[]>,
      ];
      expect(layout[0][0]).toEqual(["summary", "education", "experience", "projects"]);
      expect(breaks).toEqual({});
      expect(writeCount()).toBe(1);
    });
  });

  describe("miniature scale CSS contract", () => {
    it("publishes --sheet-k on the scaled subtree", () => {
      renderSheet();

      const transform = screen.getByTestId("doc-sheet-scale-transform");
      expect(transform.style.getPropertyValue("--sheet-k")).toBe("1");
    });

    it("keeps the page-count pill outside the scale viewport", () => {
      renderSheet();

      const viewport = screen.getByTestId("doc-sheet-scale-viewport");
      const pill = screen.getByTestId("doc-sheet-page-count");
      expect(viewport.contains(pill)).toBe(false);
      expect(screen.getByTestId("doc-sheet-scale").contains(pill)).toBe(true);
    });
  });

  describe("sidebar resize handle", () => {
    it("exposes the handle as a separator with clamped bounds", () => {
      renderSheet();

      // One handle per drawn sheet; they share the same width signal.
      const [handle] = screen.getAllByRole("separator", { name: "Resize sidebar" });
      expect(handle.getAttribute("aria-valuemin")).toBe("160");
      expect(handle.getAttribute("aria-valuemax")).toBe("360");
      expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(160);
    });

    it("persists a keyboard resize as the document's sidebar ratio", () => {
      renderSheet();

      const [handle] = screen.getAllByRole("separator", { name: "Resize sidebar" });
      fireEvent.keyDown(handle, { key: "ArrowLeft" });

      // The sidebar split is a document property (spec §4.2, owner decision):
      // it writes metadata.page.sidebarRatio, never device storage.
      expect(store.updateMetadata).toHaveBeenCalledOnce();
      const [field, page] = store.updateMetadata.mock.calls[0] as [
        string,
        { sidebarRatio: number },
      ];
      expect(field).toBe("page");
      // A right sidebar grows leftwards: ArrowLeft widens by one step.
      expect(page.sidebarRatio).toBeGreaterThan(0.1);
      expect(page.sidebarRatio).toBeLessThanOrEqual(0.5);
      expect(writeCount()).toBe(1);
    });

    it("draws the width the stored ratio dictates", () => {
      resume.metadata.page.sidebarRatio = 0.4;
      renderSheet();

      const sheet = screen.getByTestId("doc-sheet");
      // 0.4 of the sheet's content width (spec §4.2's pt-based ratio drawn in
      // sheet pixels), clamped to the handle's px bounds.
      const [handle] = screen.getAllByRole("separator", { name: "Resize sidebar" });
      const width = Number(handle.getAttribute("aria-valuenow"));
      expect(width).toBeGreaterThan(300);
      expect(width).toBeLessThanOrEqual(360);
      expect(sheet.style.getPropertyValue("--doc-sheet-side-w")).toBe(`${width}px`);
    });
  });
});
