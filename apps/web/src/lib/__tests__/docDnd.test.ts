import { describe, expect, it } from "vitest";
import {
  adjacentCustomSectionId,
  canMoveEntryAcross,
  drawnSectionPosition,
  entryStep,
  moveSectionInLayout,
  moveSectionStep,
  resolveEntryDrop,
  resolveSectionDropOnColumn,
  resolveSectionDropOnSection,
  sectionItemList,
  type EntryListItem,
} from "../docDnd";
import { editorPages, layoutPages } from "../docLayout";
import { loadDocEditorFixture, SIDEBAR_TEMPLATE } from "../../test/docEditorFixture";

/** The fixture's stored layout: two pages of two columns each. */
const LAYOUT: string[][][] = [
  [
    ["summary", "experience", "education", "projects"],
    ["profiles", "skills", "speaking"],
  ],
  [
    ["publications", "volunteer", "awards"],
    ["languages", "interests", "certifications", "advisory"],
  ],
];

function items(...ids: string[]): EntryListItem[] {
  return ids.map((id) => ({ id, visible: true }));
}

describe("moveSectionInLayout", () => {
  it("moves a section to an explicit position in another column", () => {
    const next = moveSectionInLayout(LAYOUT, "experience", { page: 0, column: 1, index: 1 });

    expect(next?.[0][0]).toEqual(["summary", "education", "projects"]);
    expect(next?.[0][1]).toEqual(["profiles", "experience", "skills", "speaking"]);
  });

  it("moves a section across pages", () => {
    const next = moveSectionInLayout(LAYOUT, "summary", { page: 1, column: 0, index: 0 });

    expect(next?.[0][0]).toEqual(["experience", "education", "projects"]);
    expect(next?.[1][0]).toEqual(["summary", "publications", "volunteer", "awards"]);
  });

  it("starts a new page when targeted one past the end", () => {
    const next = moveSectionInLayout(LAYOUT, "awards", { page: 2, column: 0, index: 0 });

    expect(next).toHaveLength(3);
    // The new page mirrors the last page's column count.
    expect(next?.[2]).toEqual([["awards"], []]);
  });

  it("materializes a drawn column the stored layout does not carry", () => {
    const layout = [[["summary", "experience"]]];

    const next = moveSectionInLayout(layout, "experience", { page: 0, column: 1, index: 0 });

    expect(next).toEqual([[["summary"], ["experience"]]]);
  });

  it("prunes a page the move left empty", () => {
    const layout = [[["summary"]], [["experience"]]];

    const next = moveSectionInLayout(layout, "experience", { page: 0, column: 0, index: 1 });

    expect(next).toEqual([[["summary", "experience"]]]);
  });

  it("returns null when the drop changes nothing", () => {
    expect(moveSectionInLayout(LAYOUT, "experience", { page: 0, column: 0, index: 1 })).toBeNull();
    // Dropping just after itself is the same order too.
    expect(moveSectionInLayout(LAYOUT, "experience", { page: 0, column: 0, index: 2 })).toBeNull();
  });

  it("returns null for a section the layout does not place", () => {
    expect(moveSectionInLayout(LAYOUT, "missing", { page: 0, column: 0, index: 0 })).toBeNull();
  });

  it("returns null for out-of-range targets", () => {
    expect(moveSectionInLayout(LAYOUT, "summary", { page: -1, column: 0, index: 0 })).toBeNull();
    expect(moveSectionInLayout(LAYOUT, "summary", { page: 0, column: -1, index: 0 })).toBeNull();
    expect(moveSectionInLayout(LAYOUT, "summary", { page: 5, column: 0, index: 0 })).toBeNull();
  });

  it("never mutates its input", () => {
    const before = JSON.parse(JSON.stringify(LAYOUT));
    moveSectionInLayout(LAYOUT, "summary", { page: 1, column: 1, index: 2 });
    expect(LAYOUT).toEqual(before);
  });
});

describe("resolveSectionDropOnSection", () => {
  it("lands after the target when dragged down within a column", () => {
    const next = resolveSectionDropOnSection(LAYOUT, "summary", "education");

    expect(next?.[0][0]).toEqual(["experience", "education", "summary", "projects"]);
  });

  it("lands before the target when dragged up within a column", () => {
    const next = resolveSectionDropOnSection(LAYOUT, "projects", "experience");

    expect(next?.[0][0]).toEqual(["summary", "projects", "experience", "education"]);
  });

  it("lands before a target in another column", () => {
    const next = resolveSectionDropOnSection(LAYOUT, "education", "skills");

    expect(next?.[0][0]).toEqual(["summary", "experience", "projects"]);
    expect(next?.[0][1]).toEqual(["profiles", "education", "skills", "speaking"]);
  });

  it("returns null when dropped on itself", () => {
    expect(resolveSectionDropOnSection(LAYOUT, "summary", "summary")).toBeNull();
  });
});

describe("resolveSectionDropOnColumn", () => {
  it("appends to the target column", () => {
    const next = resolveSectionDropOnColumn(LAYOUT, "summary", 1, 1);

    expect(next?.[1][1]).toEqual([
      "languages",
      "interests",
      "certifications",
      "advisory",
      "summary",
    ]);
  });

  it("returns null when the section is already last in that column", () => {
    expect(resolveSectionDropOnColumn(LAYOUT, "projects", 0, 0)).toBeNull();
  });

  it("returns null for a page the layout does not have", () => {
    expect(resolveSectionDropOnColumn(LAYOUT, "summary", 5, 0)).toBeNull();
  });
});

describe("moveSectionStep", () => {
  it("swaps with its neighbours within the column", () => {
    expect(moveSectionStep(LAYOUT, "experience", "up")?.[0][0]).toEqual([
      "experience",
      "summary",
      "education",
      "projects",
    ]);
    expect(moveSectionStep(LAYOUT, "experience", "down")?.[0][0]).toEqual([
      "summary",
      "education",
      "experience",
      "projects",
    ]);
  });

  it("returns null at the column boundaries", () => {
    expect(moveSectionStep(LAYOUT, "summary", "up")).toBeNull();
    expect(moveSectionStep(LAYOUT, "projects", "down")).toBeNull();
  });

  it("appends to the adjacent column, crossing pages when needed", () => {
    // Page 0 sidebar -> page 1 main: the next column in page-then-column order.
    const next = moveSectionStep(LAYOUT, "speaking", "next");
    expect(next?.[1][0]).toEqual(["publications", "volunteer", "awards", "speaking"]);

    const previous = moveSectionStep(LAYOUT, "publications", "previous");
    expect(previous?.[0][1]).toEqual(["profiles", "skills", "speaking", "publications"]);
  });

  it("returns null before the first column", () => {
    expect(moveSectionStep(LAYOUT, "summary", "previous")).toBeNull();
  });

  it("starts a new page past the last column", () => {
    const next = moveSectionStep(LAYOUT, "languages", "next");

    expect(next).toHaveLength(3);
    expect(next?.[2][0]).toEqual(["languages"]);
  });

  it("steps past slots the sheet does not draw", () => {
    // `experience` is placed but not drawn: one press must still make exactly
    // one visible change, so `summary` steps past it to the nearest drawn
    // card — never announcing a move nothing on screen reflects.
    const isDrawn = (id: string): boolean => id !== "experience";

    const next = moveSectionStep(LAYOUT, "summary", "down", isDrawn);
    expect(next?.[0][0]).toEqual(["experience", "education", "summary", "projects"]);

    const back = moveSectionStep(LAYOUT, "education", "up", isDrawn);
    expect(back?.[0][0]).toEqual(["education", "summary", "experience", "projects"]);
  });

  it("returns null when only undrawn slots remain in the step's direction", () => {
    const isDrawn = (id: string): boolean => id !== "projects";

    expect(moveSectionStep(LAYOUT, "education", "down", isDrawn)).toBeNull();
  });
});

describe("drawnSectionPosition", () => {
  it("counts drawn cards rather than layout slots", () => {
    // `experience` is placed but not drawn, so `education` is the second of
    // three cards on screen even though it holds the third layout slot.
    const isDrawn = (id: string): boolean => id !== "experience";

    expect(drawnSectionPosition(LAYOUT, "education", isDrawn)).toEqual({
      page: 0,
      column: 0,
      index: 1,
      total: 3,
    });
  });

  it("always counts the section itself as drawn", () => {
    expect(drawnSectionPosition(LAYOUT, "speaking", () => false)).toEqual({
      page: 0,
      column: 1,
      index: 0,
      total: 1,
    });
  });

  it("returns null for a section the layout does not place", () => {
    expect(drawnSectionPosition(LAYOUT, "missing")).toBeNull();
  });
});

describe("canMoveEntryAcross", () => {
  it("permits custom-to-custom only — the one pair with a shared item shape", () => {
    expect(canMoveEntryAcross("speaking", "advisory")).toBe(true);
    expect(canMoveEntryAcross("speaking", "speaking")).toBe(false);
    expect(canMoveEntryAcross("experience", "education")).toBe(false);
    expect(canMoveEntryAcross("speaking", "experience")).toBe(false);
    expect(canMoveEntryAcross("experience", "speaking")).toBe(false);
  });
});

describe("resolveEntryDrop", () => {
  const list = items("a", "b", "c");

  it("reorders within a section, landing on the target's index", () => {
    expect(
      resolveEntryDrop({
        fromSectionId: "experience",
        fromItems: list,
        itemId: "a",
        toSectionId: "experience",
        toItems: list,
        targetItemId: "c",
      }),
    ).toEqual({ kind: "reorder", sectionId: "experience", fromIndex: 0, toIndex: 2 });
  });

  it("reorders to the end when dropped on the section itself", () => {
    expect(
      resolveEntryDrop({
        fromSectionId: "experience",
        fromItems: list,
        itemId: "a",
        toSectionId: "experience",
        toItems: list,
        targetItemId: null,
      }),
    ).toEqual({ kind: "reorder", sectionId: "experience", fromIndex: 0, toIndex: 2 });
  });

  it("moves across custom sections", () => {
    expect(
      resolveEntryDrop({
        fromSectionId: "speaking",
        fromItems: list,
        itemId: "b",
        toSectionId: "advisory",
        toItems: items("x"),
        targetItemId: "x",
      }),
    ).toEqual({
      kind: "move",
      fromSectionId: "speaking",
      fromIndex: 1,
      toSectionId: "advisory",
      toIndex: 0,
    });
  });

  it("appends when dropped on the target section itself", () => {
    expect(
      resolveEntryDrop({
        fromSectionId: "speaking",
        fromItems: list,
        itemId: "b",
        toSectionId: "advisory",
        toItems: items("x"),
        targetItemId: null,
      }),
    ).toEqual({
      kind: "move",
      fromSectionId: "speaking",
      fromIndex: 1,
      toSectionId: "advisory",
      toIndex: 1,
    });
  });

  it("returns null for a drop that changes nothing", () => {
    expect(
      resolveEntryDrop({
        fromSectionId: "experience",
        fromItems: list,
        itemId: "b",
        toSectionId: "experience",
        toItems: list,
        targetItemId: "b",
      }),
    ).toBeNull();
  });

  it("returns null for an incompatible cross-section drop", () => {
    expect(
      resolveEntryDrop({
        fromSectionId: "experience",
        fromItems: list,
        itemId: "a",
        toSectionId: "education",
        toItems: items("x"),
        targetItemId: "x",
      }),
    ).toBeNull();
  });
});

describe("entryStep", () => {
  const list = items("a", "b", "c");

  it("steps one position in either direction", () => {
    expect(entryStep(list, "b", "up")).toEqual({ fromIndex: 1, toIndex: 0 });
    expect(entryStep(list, "b", "down")).toEqual({ fromIndex: 1, toIndex: 2 });
  });

  it("returns null at the boundaries and for unknown ids", () => {
    expect(entryStep(list, "a", "up")).toBeNull();
    expect(entryStep(list, "c", "down")).toBeNull();
    expect(entryStep(list, "missing", "down")).toBeNull();
  });
});

describe("adjacentCustomSectionId", () => {
  it("walks custom sections in flattened layout order", () => {
    expect(adjacentCustomSectionId(LAYOUT, "speaking", "next")).toBe("advisory");
    expect(adjacentCustomSectionId(LAYOUT, "advisory", "previous")).toBe("speaking");
  });

  it("returns null at the ends and for unknown sections", () => {
    expect(adjacentCustomSectionId(LAYOUT, "speaking", "previous")).toBeNull();
    expect(adjacentCustomSectionId(LAYOUT, "advisory", "next")).toBeNull();
    expect(adjacentCustomSectionId(LAYOUT, "experience", "next")).toBeNull();
  });
});

describe("sectionItemList", () => {
  it("reads fixed and custom sections through the shared item shape", () => {
    const resume = loadDocEditorFixture();

    expect(sectionItemList(resume, "experience").length).toBeGreaterThan(0);
    expect(sectionItemList(resume, "speaking").length).toBeGreaterThan(0);
    expect(sectionItemList(resume, "not-a-section")).toEqual([]);
  });
});

describe("editorPages", () => {
  it("stays aligned index-for-index with layoutPages", () => {
    const resume = loadDocEditorFixture();

    const layout = layoutPages(resume, SIDEBAR_TEMPLATE);
    const drawn = editorPages(resume, SIDEBAR_TEMPLATE);

    expect(drawn).toHaveLength(layout.length);
    drawn.forEach((page, pageIndex) => {
      expect(page).toHaveLength(layout[pageIndex].length);
    });
  });

  it("never draws a hidden section — the Sections panel is the recovery path", () => {
    const resume = loadDocEditorFixture();
    resume.sections.experience.visible = false;

    const drawn = editorPages(resume, SIDEBAR_TEMPLATE).flat(2);

    expect(drawn).not.toContain("experience");
  });

  it("keeps a section whose items are all hidden — the items are chrome", () => {
    const resume = loadDocEditorFixture();
    for (const item of resume.sections.experience.items) {
      item.visible = false;
    }

    const drawn = editorPages(resume, SIDEBAR_TEMPLATE).flat(2);

    expect(drawn).toContain("experience");
  });

  it("keeps an empty item section drawn — its card carries the add affordance", () => {
    const resume = loadDocEditorFixture();
    resume.sections.experience.items = [];

    const drawn = editorPages(resume, SIDEBAR_TEMPLATE).flat(2);

    expect(drawn).toContain("experience");
  });

  it("keeps an empty rich-text section reachable while it is visible", () => {
    const resume = loadDocEditorFixture();
    resume.sections.summary.content = "";
    resume.sections.summary.visible = true;

    const drawn = editorPages(resume, SIDEBAR_TEMPLATE).flat(2);

    expect(drawn).toContain("summary");
  });
});
