/**
 * The structural chrome of #729: section cards, entry action rows, add-blocks
 * and the single-pointer/keyboard move controls that mirror the drags.
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

describe("document sheet structural chrome", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
    store.store.resume = resume;
  });

  function renderSheet() {
    return render(() => <DocSheet resume={resume} templateLayout={SIDEBAR_TEMPLATE} />);
  }

  describe("section cards", () => {
    it("hides a fixed section through toggleSectionVisibility, and says so", async () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Hide Experience section" }));

      expect(store.toggleSectionVisibility).toHaveBeenCalledExactlyOnceWith("experience");
      expect(writeCount()).toBe(1);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(/Experience section hidden/i);
      });
    });

    it("hides a custom section through updateCustomSection", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Hide Talks & Workshops section" }));

      expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
        visible: false,
      });
    });

    it("keeps a hidden section on the surface, flagged, with a Show control", () => {
      resume.sections.experience.visible = false;
      renderSheet();

      const section = document.querySelector('[data-section-id="experience"]');
      expect(section).toBeTruthy();
      expect(section?.classList.contains("doc-sheet__section--hidden")).toBe(true);

      fireEvent.click(screen.getByRole("button", { name: "Show Experience section" }));

      expect(store.toggleSectionVisibility).toHaveBeenCalledExactlyOnceWith("experience");
    });

    it("keeps a hidden, empty summary on the surface with a Show control", () => {
      // Regression: rich text has no add-block, so if hiding an empty summary
      // dropped its card, nothing on the sheet could ever show it again.
      resume.sections.summary.content = "";
      resume.sections.summary.visible = false;
      renderSheet();

      const summary = document.querySelector('[data-section-id="summary"]');
      expect(summary).toBeTruthy();
      expect(summary?.classList.contains("doc-sheet__section--hidden")).toBe(true);

      fireEvent.click(screen.getByRole("button", { name: "Show Summary section" }));

      expect(store.toggleSectionVisibility).toHaveBeenCalledExactlyOnceWith("summary");
    });

    it("deletes a custom section through removeCustomSection", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Delete Talks & Workshops section" }));

      expect(store.removeCustomSection).toHaveBeenCalledExactlyOnceWith("speaking");
      expect(writeCount()).toBe(1);
    });

    it("offers no delete for fixed sections", () => {
      renderSheet();

      expect(screen.queryByRole("button", { name: "Delete Experience section" })).toBeNull();
    });

    it("renames a custom section through its dialog", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Rename Talks & Workshops section" }));
      fireEvent.input(screen.getByRole("textbox", { name: "Section name" }), {
        target: { value: "Talks" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Rename" }));

      expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
        name: "Talks",
      });
    });
  });

  describe("section move controls", () => {
    it("moves a section one step down through one updateLayout call", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Move Experience section down" }));

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

    it("moves a section to the next column, across pages", () => {
      renderSheet();

      fireEvent.click(
        screen.getByRole("button", { name: "Move Talks & Workshops section to the next column" }),
      );

      const [layout] = store.updateLayout.mock.calls[0] as [string[][][]];
      expect(layout[0][1]).toEqual(["profiles", "skills"]);
      expect(layout[1][0]).toEqual(["publications", "volunteer", "awards", "speaking"]);
    });

    it("announces the move in drawn-card terms", async () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Move Experience section down" }));

      await waitFor(() => {
        expect(liveRegionText()).toMatch(
          /Experience section moved to position 3 of 4 in column 1 of page 1/i,
        );
      });
    });

    it("hands focus back to the control that was used", async () => {
      renderSheet();
      const control = screen.getByRole("button", { name: "Move Experience section down" });

      fireEvent.click(control);

      // The refocus rides requestAnimationFrame, after the sheet redraws.
      await waitFor(() => expect(document.activeElement).toBe(control));
    });

    it("steps past a placed-but-undrawn section, and counts only drawn cards", async () => {
      // `education` keeps its layout slot but has nothing to draw, so one
      // press on Experience must clear it in a single visible step — and the
      // announced position must match the three cards on screen, not the four
      // slots in the layout.
      resume.sections.education.items = [];
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Move Experience section down" }));

      const [layout] = store.updateLayout.mock.calls[0] as [string[][][]];
      expect(layout[0][0]).toEqual(["summary", "education", "projects", "experience"]);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(
          /Experience section moved to position 3 of 3 in column 1 of page 1/i,
        );
      });
    });

    it("writes nothing at a boundary, and says so", async () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Move Summary section up" }));

      expect(store.updateLayout).not.toHaveBeenCalled();
      expect(writeCount()).toBe(0);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(/Summary section did not move/i);
      });
    });
  });

  describe("entry actions", () => {
    it("duplicates an entry through duplicateSectionItem", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Duplicate Lumen Health" }));

      expect(store.duplicateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0);
      expect(writeCount()).toBe(1);
    });

    it("deletes the right entry through removeSectionItem, and says so", async () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Delete Lumen Health" }));

      expect(store.removeSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(/Lumen Health deleted/i);
      });
    });

    it("hides an entry, keeps it drawn, and can show it again", () => {
      const first = renderSheet();
      fireEvent.click(screen.getByRole("button", { name: "Hide Lumen Health" }));
      expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
        visible: false,
      });

      // Redraw with the item actually hidden: still present, now as chrome.
      // Unmounted first, so the queries below see exactly one sheet.
      first.unmount();
      resume.sections.experience.items[0].visible = false;
      vi.clearAllMocks();
      renderSheet();

      expect(screen.getByRole("button", { name: "Show Lumen Health" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Show Lumen Health" }));
      expect(store.updateSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, {
        visible: true,
      });
    });

    it("routes a custom entry's actions to the custom store actions", () => {
      renderSheet();

      fireEvent.click(
        screen.getByRole("button", { name: "Duplicate Design Tokens Beyond Colour" }),
      );

      expect(store.duplicateCustomSectionItem).toHaveBeenCalledExactlyOnceWith("speaking", 0);
    });
  });

  describe("entry move controls", () => {
    it("reorders within the section through one reorderSectionItem call", async () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Move Lumen Health down" }));

      expect(store.reorderSectionItem).toHaveBeenCalledExactlyOnceWith("experience", 0, 1);
      expect(writeCount()).toBe(1);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(/Lumen Health moved to position 2 of \d+/i);
      });
    });

    it("performs the same mutation as the equivalent drag would", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Move Lumen Health down" }));

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

    it("offers lateral moves only where a cross-section drag exists", () => {
      renderSheet();

      // Fixed sections share no item shape with anything: vertical moves only.
      expect(
        screen.queryByRole("button", { name: "Move Lumen Health to the next section" }),
      ).toBeNull();
      // Custom entries can drag to another custom section, so the keyboard
      // and single-pointer path exists too.
      expect(
        screen.getByRole("button", {
          name: "Move Design Tokens Beyond Colour to the next section",
        }),
      ).toBeInTheDocument();
    });

    it("moves a custom entry to the adjacent custom section in one action", async () => {
      renderSheet();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Move Design Tokens Beyond Colour to the next section",
        }),
      );

      const advisoryLength = resume.sections.custom.advisory.items.length;
      expect(store.moveCustomSectionItem).toHaveBeenCalledExactlyOnceWith(
        "speaking",
        0,
        "advisory",
        advisoryLength,
      );
      expect(writeCount()).toBe(1);
      await waitFor(() => {
        expect(liveRegionText()).toMatch(/Design Tokens Beyond Colour moved to/i);
      });
    });

    it("writes nothing at a boundary", () => {
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Move Lumen Health up" }));

      expect(writeCount()).toBe(0);
    });
  });

  describe("add-blocks", () => {
    it("offers a placed-but-empty section as an add affordance", () => {
      resume.sections.projects.items = [];
      renderSheet();

      fireEvent.click(screen.getByRole("button", { name: "Add project" }));
      // Scoped to the dialog: the add-block trigger shares the same name.
      const dialog = screen.getByRole("dialog");
      fireEvent.input(within(dialog).getByRole("textbox", { name: "Name" }), {
        target: { value: "Halo" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Add project" }));

      expect(store.addSectionItem).toHaveBeenCalledOnce();
      const [sectionId, item] = store.addSectionItem.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(sectionId).toBe("projects");
      expect(item.name).toBe("Halo");
      expect(item.visible).toBe(true);
    });

    it("draws no add-block when every placed section has content", () => {
      renderSheet();

      expect(screen.queryByTestId("doc-sheet-add-block")).toBeNull();
    });
  });

  describe("drag chrome", () => {
    it("gives cards and entries drag handles rather than surface capture", () => {
      renderSheet();

      expect(
        screen.getByRole("button", { name: "Drag Experience section to move it" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Drag Lumen Health to move it" }),
      ).toBeInTheDocument();
      // The section surface itself must not be a drag activator, or text
      // selection and inline editing would fight the drag sensor.
      const section = document.querySelector('[data-section-id="experience"]');
      expect(section?.getAttribute("draggable")).toBeNull();
    });

    it("keeps the new-page drop zone mounted but inert until a section drag", () => {
      renderSheet();

      const zone = screen.getByTestId("doc-sheet-new-page");
      expect(zone.getAttribute("aria-hidden")).toBe("true");
      expect(zone.classList.contains("doc-sheet__new-page--active")).toBe(false);
    });
  });
});
