import { describe, expect, it } from "vitest";
import {
  editorSheetPages,
  expandItemBreakPages,
  itemBreaksWithBreakBefore,
  itemBreaksWithoutSection,
  itemSlices,
  orderedItemBreaks,
  renderSheetPages,
  resolvePageBreakRemoval,
  sanitizedItemBreaks,
  sectionSliceAt,
  sectionSupportsItemBreaks,
  splitLayoutBeforeSection,
  templateSupportsItemBreaks,
} from "../docPagination";
import {
  loadDocEditorFixture,
  SIDEBAR_TEMPLATE,
  SINGLE_TEMPLATE,
} from "../../test/docEditorFixture";
import type { ResumeData } from "../../wasm/types";

/** The shared doc-editor fixture, optionally seeded with break markers. */
function loadBreakFixture(breaks?: Record<string, string[]>): ResumeData {
  const resume = loadDocEditorFixture();
  if (breaks !== undefined) {
    resume.metadata.itemBreaks = breaks;
  }
  return resume;
}

describe("sectionSupportsItemBreaks", () => {
  it("allows main-flow sections only (spec §3.4 guard)", () => {
    expect(sectionSupportsItemBreaks("experience")).toBe(true);
    expect(sectionSupportsItemBreaks("references")).toBe(true);
    expect(sectionSupportsItemBreaks("skills")).toBe(false);
    expect(sectionSupportsItemBreaks("profiles")).toBe(false);
    expect(sectionSupportsItemBreaks("summary")).toBe(false);
    expect(sectionSupportsItemBreaks("speaking")).toBe(false);
  });
});

describe("templateSupportsItemBreaks", () => {
  it("is true for single-flow templates only — Typst cannot break a grid", () => {
    expect(templateSupportsItemBreaks(SINGLE_TEMPLATE)).toBe(true);
    expect(templateSupportsItemBreaks(SIDEBAR_TEMPLATE)).toBe(false);
  });
});

describe("itemSlices", () => {
  it("starts a new slice at every marker", () => {
    expect(itemSlices(["a", "b", "c", "d"], ["c"])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(itemSlices(["a", "b", "c"], ["b", "c"])).toEqual([["a"], ["b"], ["c"]]);
  });

  it("treats a marker on the first item as inert — slices are never empty", () => {
    expect(itemSlices(["a", "b"], ["a"])).toEqual([["a", "b"]]);
  });

  it("passes empty inputs through", () => {
    expect(itemSlices([], ["a"])).toEqual([[]]);
    expect(itemSlices(["a"], [])).toEqual([["a"]]);
  });
});

describe("orderedItemBreaks", () => {
  it("orders markers by item position and drops unknown ids", () => {
    const resume = loadBreakFixture({ experience: ["exp-3", "exp-2", "ghost"] });

    expect(orderedItemBreaks(resume, "experience", true)).toEqual(["exp-2", "exp-3"]);
  });

  it("ignores markers on sections that cannot carry them", () => {
    const resume = loadBreakFixture({ skills: ["skill-1"] });

    expect(orderedItemBreaks(resume, "skills", true)).toEqual([]);
  });

  it("drops a hidden item's marker when hidden items are not drawn", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });
    resume.sections.experience.items[1].visible = false;

    expect(orderedItemBreaks(resume, "experience", false)).toEqual([]);
    expect(orderedItemBreaks(resume, "experience", true)).toEqual(["exp-2"]);
  });
});

describe("expandItemBreakPages", () => {
  it("places a broken section on consecutive pages in the same column", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });

    const pages = expandItemBreakPages(resume, SINGLE_TEMPLATE, true);

    expect(pages[0][0]).toContain("experience");
    // The continuation is prepended to the next page's same column.
    expect(pages[1][0][0]).toBe("experience");
  });

  it("creates missing pages for trailing continuations", () => {
    const resume = loadBreakFixture({ experience: ["exp-2", "exp-3"] });
    resume.metadata.layout = [[["summary", "experience"]]];

    const pages = expandItemBreakPages(resume, SINGLE_TEMPLATE, true);

    expect(pages).toHaveLength(3);
    expect(pages[1][0]).toEqual(["experience"]);
    expect(pages[2][0]).toEqual(["experience"]);
  });

  it("expands nothing on templates whose layout cannot honor breaks", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });

    const pages = expandItemBreakPages(resume, SIDEBAR_TEMPLATE, true);

    expect(pages.flat(2).filter((id) => id === "experience")).toHaveLength(1);
  });
});

describe("sectionSliceAt", () => {
  it("names each instance's items, index and last-ness", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });

    const first = sectionSliceAt(resume, SINGLE_TEMPLATE, "experience", 0, 0, true);
    const second = sectionSliceAt(resume, SINGLE_TEMPLATE, "experience", 1, 0, true);

    expect(first).toEqual({ index: 0, itemIds: ["exp-1"], isLast: false });
    expect(second).toEqual({ index: 1, itemIds: ["exp-2", "exp-3"], isLast: true });
  });

  it("returns null for unbroken sections and unsupported templates", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });

    expect(sectionSliceAt(resume, SINGLE_TEMPLATE, "education", 0, 0, true)).toBeNull();
    expect(sectionSliceAt(resume, SIDEBAR_TEMPLATE, "experience", 0, 0, true)).toBeNull();
  });
});

describe("renderSheetPages / editorSheetPages with breaks", () => {
  it("draws the continuation in both modes", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });

    for (const pages of [
      renderSheetPages(resume, SINGLE_TEMPLATE),
      editorSheetPages(resume, SINGLE_TEMPLATE),
    ]) {
      expect(pages[0][0]).toContain("experience");
      expect(pages[1][0][0]).toBe("experience");
    }
  });

  it("drops only trailing empty pages so drawn indices stay aligned", () => {
    const resume = loadBreakFixture();
    resume.metadata.layout = [[["experience"]], [["references"]], [["education"]]];
    // References holds items in the fixture; hide the section so page 1
    // renders empty mid-stack.
    resume.sections.references.visible = false;

    const pages = renderSheetPages(resume, SINGLE_TEMPLATE);

    expect(pages).toHaveLength(3);
    expect(pages[1]).toEqual([[]]);
  });
});

describe("itemBreaksWithBreakBefore", () => {
  it("appends a marker for a breakable item", () => {
    const resume = loadBreakFixture();

    expect(itemBreaksWithBreakBefore(resume, SINGLE_TEMPLATE, "experience", "exp-2")).toEqual({
      experience: ["exp-2"],
    });
  });

  it("returns null for inert markers: first item, duplicates, guards", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });

    expect(itemBreaksWithBreakBefore(resume, SINGLE_TEMPLATE, "experience", "exp-1")).toBeNull();
    expect(itemBreaksWithBreakBefore(resume, SINGLE_TEMPLATE, "experience", "exp-2")).toBeNull();
    expect(itemBreaksWithBreakBefore(resume, SINGLE_TEMPLATE, "experience", "ghost")).toBeNull();
    expect(itemBreaksWithBreakBefore(resume, SINGLE_TEMPLATE, "skills", "skill-1")).toBeNull();
    expect(itemBreaksWithBreakBefore(resume, SIDEBAR_TEMPLATE, "experience", "exp-3")).toBeNull();
  });
});

describe("itemBreaksWithoutSection", () => {
  it("removes the section's markers and reports no-ops as null", () => {
    expect(
      itemBreaksWithoutSection({ experience: ["exp-2"], education: ["edu-2"] }, "experience"),
    ).toEqual({ education: ["edu-2"] });
    expect(itemBreaksWithoutSection({ education: ["edu-2"] }, "experience")).toBeNull();
    expect(itemBreaksWithoutSection(undefined, "experience")).toBeNull();
  });
});

describe("splitLayoutBeforeSection", () => {
  const layout = [
    [
      ["summary", "experience", "education"],
      ["profiles", "skills"],
    ],
  ];

  it("moves the section and its column tail to a fresh page", () => {
    expect(splitLayoutBeforeSection(layout, "experience")).toEqual([
      [["summary"], ["profiles", "skills"]],
      [["experience", "education"], []],
    ]);
  });

  it("splits a whole column away when the page keeps other content", () => {
    expect(splitLayoutBeforeSection(layout, "summary")).toEqual([
      [[], ["profiles", "skills"]],
      [["summary", "experience", "education"], []],
    ]);
  });

  it("returns null when the split reproduces the same stack", () => {
    expect(splitLayoutBeforeSection([[["summary", "experience"]]], "summary")).toBeNull();
    expect(splitLayoutBeforeSection(layout, "missing")).toBeNull();
  });
});

describe("resolvePageBreakRemoval", () => {
  it("prefers clearing the item break shared across the boundary", () => {
    const resume = loadBreakFixture({ experience: ["exp-2"] });

    const removal = resolvePageBreakRemoval(resume, SINGLE_TEMPLATE, 1);

    expect(removal).toEqual({ kind: "itemBreaks", itemBreaks: {} });
  });

  it("clears only the responsible marker of a multi-break section", () => {
    const resume = loadBreakFixture({ experience: ["exp-2", "exp-3"] });
    resume.metadata.layout = [[["summary", "experience"]]];

    const removal = resolvePageBreakRemoval(resume, SINGLE_TEMPLATE, 1);

    expect(removal).toEqual({
      kind: "itemBreaks",
      itemBreaks: { experience: ["exp-3"] },
    });
  });

  it("falls back to merging the raw pages column-wise", () => {
    const resume = loadBreakFixture();

    const removal = resolvePageBreakRemoval(resume, SIDEBAR_TEMPLATE, 1);

    expect(removal).toEqual({
      kind: "layout",
      layout: [
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
      ],
    });
  });

  it("returns null for page 0 and out-of-range pages", () => {
    const resume = loadBreakFixture();

    expect(resolvePageBreakRemoval(resume, SIDEBAR_TEMPLATE, 0)).toBeNull();
    expect(resolvePageBreakRemoval(resume, SIDEBAR_TEMPLATE, 9)).toBeNull();
  });
});

describe("sanitizedItemBreaks", () => {
  it("strips non-main-flow sections and empty marker lists", () => {
    expect(
      sanitizedItemBreaks({
        experience: ["exp-2"],
        skills: ["skill-1"],
        education: [],
      }),
    ).toEqual({ experience: ["exp-2"] });
  });

  it("returns null when nothing needed stripping", () => {
    expect(sanitizedItemBreaks(undefined)).toBeNull();
    expect(sanitizedItemBreaks({ experience: ["exp-2"] })).toBeNull();
  });
});
