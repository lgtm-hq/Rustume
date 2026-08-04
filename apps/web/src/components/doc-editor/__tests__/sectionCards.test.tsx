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
import { loadDocEditorFixture, SIDEBAR_TEMPLATE } from "../../../test/docEditorFixture";
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
  moveCustomSectionItem: vi.fn(),
  updateLayout: vi.fn(),
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

describe("document sheet structural chrome", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
    store.store.resume = resume;
  });

  function renderSheet(options: { onOpenSections?: () => void } = {}) {
    return render(() => (
      <DocSheet
        resume={resume}
        templateLayout={SIDEBAR_TEMPLATE}
        onOpenSections={options.onOpenSections}
      />
    ));
  }

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

  describe("drag chrome", () => {
    it("gives cards and entries drag handles rather than surface capture", () => {
      renderSheet();

      // Handles are pointer-only chrome: out of the tab order and hidden from
      // assistive tech (the menu and pill are the keyboard/SR path), so they
      // are found by title rather than accessible name.
      const sectionHandle = screen.getByTitle("Drag Experience section to move it");
      const entryHandle = screen.getByTitle(`Drag ${FIRST_EXPERIENCE} to move it`);
      expect(sectionHandle).toBeInTheDocument();
      expect(entryHandle).toBeInTheDocument();
      expect(sectionHandle.getAttribute("tabindex")).toBe("-1");
      expect(sectionHandle.getAttribute("aria-hidden")).toBe("true");
      expect(entryHandle.getAttribute("tabindex")).toBe("-1");
      expect(entryHandle.getAttribute("aria-hidden")).toBe("true");
      // The section surface itself must not be a drag activator, or text
      // selection and inline editing would fight the drag sensor.
      const section = document.querySelector('[data-section-id="experience"]');
      expect(section?.getAttribute("draggable")).toBeNull();
    });

    it("gives the basics contact block no grip, menu, or drag chrome", () => {
      renderSheet();

      const contact = document.querySelector('[data-section-id="basics"]');
      expect(contact).not.toBeNull();
      expect(contact?.querySelector(".doc-sheet__sec-grip")).toBeNull();
      expect(contact?.querySelector(".doc-sheet__sec-pencil")).toBeNull();
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
