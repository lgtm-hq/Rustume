import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUSTOM_SECTION_SENTINEL,
  DEFAULT_DOC_FONT_FAMILY,
  NOSEPASS_DOC_FONT_FAMILY,
  docFontStack,
  emptyItemFor,
  FIXED_SECTION_IDS,
  findSectionPlacement,
  isCustomId,
  layoutColumns,
  layoutForTemplate,
  layoutPages,
  mergePageIntoPrevious,
  nextId,
  SECTION_LABELS,
  sectionTitle,
  sectionVisible,
  templateDocFontFamily,
  type TemplateLayout,
} from "../docLayout";
import { renderSheetPages } from "../docPagination";
import {
  HEADER_SPLIT_TEMPLATE,
  loadDocEditorFixture as loadFixture,
  PROPORTIONAL_TEMPLATE,
  SIDEBAR_TEMPLATE,
  SINGLE_TEMPLATE,
} from "../../test/docEditorFixture";

describe("FIXED_SECTION_IDS / SECTION_LABELS", () => {
  it("covers every fixed section exactly once", () => {
    expect(new Set(FIXED_SECTION_IDS).size).toBe(FIXED_SECTION_IDS.length);
    expect(FIXED_SECTION_IDS).toContain("summary");
    expect(FIXED_SECTION_IDS).toContain("experience");
    expect(FIXED_SECTION_IDS).not.toContain(CUSTOM_SECTION_SENTINEL);
  });

  it("labels every fixed section", () => {
    for (const id of FIXED_SECTION_IDS) {
      expect(SECTION_LABELS[id]).toBeTruthy();
    }
    expect(SECTION_LABELS.coverLetter).toBe("Cover Letter");
  });
});

describe("layoutPages", () => {
  it("honours the resume's stored layout", () => {
    const resume = loadFixture();

    expect(layoutPages(resume, SIDEBAR_TEMPLATE)).toEqual([
      [
        ["summary", "experience", "education", "projects"],
        ["profiles", "skills", "speaking"],
      ],
      [
        ["publications", "volunteer", "awards"],
        ["languages", "interests", "certifications", "advisory"],
      ],
    ]);
  });

  it("falls back to the template's default columns when the layout is empty", () => {
    const resume = loadFixture();
    resume.metadata.layout = [];

    const pages = layoutPages(resume, SIDEBAR_TEMPLATE);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(2);
    expect(pages[0][0][0]).toBe("summary");
    expect(pages[0][1][0]).toBe("profiles");
    // The `custom` sentinel expands to the resume's own custom sections.
    expect(pages[0][0]).toContain("speaking");
    expect(pages[0][0]).toContain("advisory");
    expect(pages[0].flat()).not.toContain(CUSTOM_SECTION_SENTINEL);
  });

  it("collapses a single-column template to one column", () => {
    const resume = loadFixture();
    resume.metadata.layout = [];

    const pages = layoutPages(resume, SINGLE_TEMPLATE);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(1);
    expect(pages[0][0]).toContain("languages");
  });

  it("falls back to the template defaults when the stored layout holds only empty columns", () => {
    const resume = loadFixture();
    resume.metadata.layout = [[[], []]];

    const pages = layoutPages(resume, SIDEBAR_TEMPLATE);

    expect(pages).toHaveLength(1);
    expect(pages[0][0][0]).toBe("summary");
    expect(pages[0][1][0]).toBe("profiles");
  });

  it("expands the custom sentinel only once", () => {
    const resume = loadFixture();
    resume.metadata.layout = [
      [
        ["experience", CUSTOM_SECTION_SENTINEL],
        [CUSTOM_SECTION_SENTINEL, "skills"],
      ],
    ];

    expect(layoutPages(resume, SIDEBAR_TEMPLATE)).toEqual([
      [["experience", "speaking", "advisory"], ["skills"]],
    ]);
  });

  it("keeps only the first occurrence of a repeated section id", () => {
    const resume = loadFixture();
    resume.metadata.layout = [[["experience", "skills"], ["experience"]]];

    expect(layoutPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience", "skills"], []]]);
  });

  it("drops ids that address no section", () => {
    const resume = loadFixture();
    resume.metadata.layout = [[["experience", "not-a-section"]]];

    expect(layoutPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"]]]);
  });
});

describe("renderSheetPages (no item breaks)", () => {
  it("drops hidden sections", () => {
    const resume = loadFixture();

    const pages = renderSheetPages(resume, SIDEBAR_TEMPLATE);

    // `advisory` is a custom section with `visible: false`.
    expect(pages[1][1]).toEqual(["languages", "interests", "certifications"]);
  });

  it("drops sections with no content", () => {
    const resume = loadFixture();
    resume.sections.awards.items = [];
    resume.metadata.layout = [[["awards", "experience"]]];

    expect(renderSheetPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"]]]);
  });

  it("drops a section whose items are all hidden", () => {
    const resume = loadFixture();
    resume.sections.publications.items = resume.sections.publications.items.map((item) => ({
      ...item,
      visible: false,
    }));
    resume.metadata.layout = [[["publications", "experience"]]];

    expect(renderSheetPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"]]]);
  });

  it("keeps a column emptied by filtering so column indices stay stable", () => {
    const resume = loadFixture();
    resume.metadata.layout = [[["experience"], ["advisory"]]];

    expect(renderSheetPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"], []]]);
  });

  it("removes a page left empty by filtering", () => {
    const resume = loadFixture();
    resume.metadata.layout = [[["experience"]], [["references", "advisory"]]];

    expect(renderSheetPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"]]]);
  });

  it("keeps a page that still has content", () => {
    const resume = loadFixture();

    const pages = renderSheetPages(resume, SIDEBAR_TEMPLATE);

    expect(pages).toHaveLength(2);
    expect(pages[0][0]).toEqual(["summary", "experience", "education", "projects"]);
    expect(pages[0][1]).toEqual(["profiles", "skills", "speaking"]);
  });
});

describe("layoutColumns", () => {
  it("describes a single-column template as one full-width column", () => {
    expect(layoutColumns([["summary", "experience"]], SINGLE_TEMPLATE)).toEqual([
      { index: 0, role: "main", width: 1, order: 0 },
    ]);
  });

  it("derives sidebar width from the template's fixed sidebar", () => {
    const columns = layoutColumns([["summary"], ["profiles"]], SIDEBAR_TEMPLATE);

    expect(columns).toHaveLength(2);
    expect(columns[1].role).toBe("sidebar");
    // 180pt of a nominal A4 content width (595.28pt - 2 * 18pt).
    expect(columns[1].width).toBeCloseTo(180 / (595.28 - 2 * 18), 10);
    expect(columns[0].width).toBeCloseTo(1 - columns[1].width, 10);
    // A left sidebar paints before the main column.
    expect(columns[0].order).toBe(1);
    expect(columns[1].order).toBe(0);
  });

  it("clamps a sidebar wider than half the content width", () => {
    const columns = layoutColumns([["summary"], ["profiles"]], {
      ...SIDEBAR_TEMPLATE,
      sidebarWidth: 500,
    });

    expect(columns[1].width).toBeCloseTo(0.5, 10);
  });

  it("clamps a sidebar narrower than a tenth of the content width", () => {
    const columns = layoutColumns([["summary"], ["profiles"]], {
      ...SIDEBAR_TEMPLATE,
      sidebarWidth: 10,
    });

    expect(columns[1].width).toBeCloseTo(0.1, 10);
  });

  it("uses the proportional default when the template has no fixed sidebar", () => {
    const columns = layoutColumns([["summary"], ["profiles"]], PROPORTIONAL_TEMPLATE);

    expect(columns[1].width).toBeCloseTo(1 / 3, 10);
    expect(columns[0].order).toBe(0);
    expect(columns[1].order).toBe(1);
  });

  it("gives a sidebar template its second column even on a one-column page", () => {
    expect(layoutColumns([["summary"]], SIDEBAR_TEMPLATE)).toHaveLength(2);
  });

  it("splits a header-split template evenly, ignoring any sidebar width", () => {
    const columns = layoutColumns([["summary"], ["profiles"]], {
      ...HEADER_SPLIT_TEMPLATE,
      sidebarWidth: 180,
    });

    expect(columns).toHaveLength(2);
    expect(columns.map((column) => column.width)).toEqual([0.5, 0.5]);
    expect(columns.map((column) => column.order)).toEqual([0, 1]);
  });

  it("shares width evenly when a page carries more columns than the mode implies", () => {
    const columns = layoutColumns([["a"], ["b"], ["c"]], SIDEBAR_TEMPLATE);

    expect(columns).toHaveLength(3);
    for (const column of columns) {
      expect(column.width).toBeCloseTo(1 / 3, 10);
    }
  });
});

describe("findSectionPlacement", () => {
  it("finds a fixed section", () => {
    const resume = loadFixture();

    expect(findSectionPlacement(resume.metadata.layout, "experience")).toEqual({
      page: 0,
      column: 0,
      index: 1,
    });
  });

  it("finds a custom section on a later page", () => {
    const resume = loadFixture();

    expect(findSectionPlacement(resume.metadata.layout, "advisory")).toEqual({
      page: 1,
      column: 1,
      index: 3,
    });
  });

  it("returns null for a section that is not placed", () => {
    const resume = loadFixture();

    expect(findSectionPlacement(resume.metadata.layout, "references")).toBeNull();
  });
});

describe("mergePageIntoPrevious", () => {
  it("concatenates the page's columns onto the previous page, index-wise", () => {
    const layout = [
      [["summary"], ["skills"]],
      [["experience"], ["languages"]],
    ];

    expect(mergePageIntoPrevious(layout, 1)).toEqual([
      [
        ["summary", "experience"],
        ["skills", "languages"],
      ],
    ]);
  });

  it("keeps the first occurrence when the same id appears on both pages", () => {
    const layout = [
      [["summary", "experience"], ["skills"]],
      [["experience", "projects"], []],
    ];

    expect(mergePageIntoPrevious(layout, 1)).toEqual([
      [["summary", "experience", "projects"], ["skills"]],
    ]);
  });

  it("dedups across columns, not just within the same column index", () => {
    const layout = [
      [["summary"], ["skills"]],
      [
        ["skills", "projects"],
        ["summary", "languages"],
      ],
    ];

    expect(mergePageIntoPrevious(layout, 1)).toEqual([
      [
        ["summary", "projects"],
        ["skills", "languages"],
      ],
    ]);
  });

  it("merges ragged column counts without dropping a column", () => {
    const layout = [[["summary"]], [["experience"], ["languages"]]];

    expect(mergePageIntoPrevious(layout, 1)).toEqual([[["summary", "experience"], ["languages"]]]);
  });

  it("leaves later pages untouched", () => {
    const layout = [[["a"]], [["b"]], [["c"]]];

    expect(mergePageIntoPrevious(layout, 1)).toEqual([[["a", "b"]], [["c"]]]);
  });

  it("returns null when the merge is impossible", () => {
    const layout = [[["summary"]], [["experience"]]];

    expect(mergePageIntoPrevious(layout, 0)).toBeNull();
    expect(mergePageIntoPrevious(layout, 2)).toBeNull();
    expect(mergePageIntoPrevious(layout, -1)).toBeNull();
  });

  it("never mutates its input", () => {
    const layout = [[["summary"]], [["experience"]]];
    const snapshot = structuredClone(layout);

    mergePageIntoPrevious(layout, 1);

    expect(layout).toEqual(snapshot);
  });
});

describe("sectionVisible", () => {
  it("reports fixed sections", () => {
    const resume = loadFixture();

    expect(sectionVisible(resume, "experience")).toBe(true);
    expect(sectionVisible(resume, "references")).toBe(false);
  });

  it("reports custom sections", () => {
    const resume = loadFixture();

    expect(sectionVisible(resume, "speaking")).toBe(true);
    expect(sectionVisible(resume, "advisory")).toBe(false);
  });

  it("treats an unknown id as not visible", () => {
    expect(sectionVisible(loadFixture(), "not-a-section")).toBe(false);
  });
});

describe("sectionTitle", () => {
  it("uses the section's own name", () => {
    const resume = loadFixture();

    expect(sectionTitle(resume, "volunteer")).toBe("Volunteering");
    expect(sectionTitle(resume, "speaking")).toBe("Talks & Workshops");
  });

  it("falls back to the canonical label when a name is blank", () => {
    const resume = loadFixture();
    resume.sections.experience.name = "  ";

    expect(sectionTitle(resume, "experience")).toBe("Experience");
  });

  it("falls back to a placeholder for an unnamed custom section", () => {
    const resume = loadFixture();
    resume.sections.custom.speaking.name = "";

    expect(sectionTitle(resume, "speaking")).toBe("Untitled");
  });

  it("returns an empty string for an unknown id", () => {
    expect(sectionTitle(loadFixture(), "not-a-section")).toBe("");
  });
});

describe("isCustomId", () => {
  it("recognises custom section ids", () => {
    expect(isCustomId("speaking")).toBe(true);
    expect(isCustomId(CUSTOM_SECTION_SENTINEL)).toBe(true);
  });

  it("rejects fixed section ids and the empty id", () => {
    expect(isCustomId("experience")).toBe(false);
    expect(isCustomId("summary")).toBe(false);
    expect(isCustomId("")).toBe(false);
  });
});

describe("nextId", () => {
  it("starts at one when nothing is taken", () => {
    expect(nextId("section", [])).toBe("section-1");
  });

  it("skips taken ids", () => {
    expect(nextId("section", ["section-1", "section-2"])).toBe("section-3");
  });

  it("ignores gaps left by unrelated prefixes", () => {
    expect(nextId("item", ["section-1", "item-1"])).toBe("item-2");
  });
});

describe("layoutForTemplate", () => {
  it("adopts the template's default columns", () => {
    const resume = loadFixture();

    const layout = layoutForTemplate(resume, SIDEBAR_TEMPLATE);

    expect(layout).toHaveLength(1);
    expect(layout[0]).toHaveLength(2);
    expect(layout[0][0][0]).toBe("summary");
    expect(layout[0][1]).toEqual(["profiles", "skills", "interests", "languages"]);
  });

  it("preserves every custom section across single -> sidebar -> single", () => {
    const resume = loadFixture();
    const customIds = Object.keys(resume.sections.custom);

    const single = layoutForTemplate(resume, SINGLE_TEMPLATE);
    resume.metadata.layout = single;
    const sidebar = layoutForTemplate(resume, SIDEBAR_TEMPLATE);
    resume.metadata.layout = sidebar;
    const backToSingle = layoutForTemplate(resume, SINGLE_TEMPLATE);

    for (const layout of [single, sidebar, backToSingle]) {
      for (const id of customIds) {
        expect(layout.flat(2)).toContain(id);
      }
    }
    expect(single[0]).toHaveLength(1);
    expect(backToSingle[0]).toHaveLength(1);
  });

  it("re-places custom sections the template defaults never mention", () => {
    const resume = loadFixture();
    const withoutSentinel: TemplateLayout = {
      ...SIDEBAR_TEMPLATE,
      defaultColumns: [
        SIDEBAR_TEMPLATE.defaultColumns[0].filter((id) => id !== CUSTOM_SECTION_SENTINEL),
        SIDEBAR_TEMPLATE.defaultColumns[1],
      ],
    };

    const layout = layoutForTemplate(resume, withoutSentinel);

    expect(layout[0][0]).toContain("speaking");
    expect(layout[0][0]).toContain("advisory");
  });

  it("preserves a placed fixed section the template defaults omit", () => {
    const resume = loadFixture();
    // No template lists `coverLetter` in its default columns.
    resume.metadata.layout = [[["coverLetter", "experience"], []]];

    const layout = layoutForTemplate(resume, SIDEBAR_TEMPLATE);

    expect(layout.flat(2)).toContain("coverLetter");
  });

  it("does not mutate the resume or the template layout", () => {
    const resume = loadFixture();
    const before = JSON.stringify(resume.metadata.layout);
    const templateBefore = JSON.stringify(SINGLE_TEMPLATE.defaultColumns);

    layoutForTemplate(resume, SINGLE_TEMPLATE);

    expect(JSON.stringify(resume.metadata.layout)).toBe(before);
    expect(JSON.stringify(SINGLE_TEMPLATE.defaultColumns)).toBe(templateBefore);
  });
});

describe("emptyItemFor", () => {
  it("shapes an experience item", () => {
    expect(emptyItemFor("experience")).toEqual({
      id: "",
      visible: true,
      company: "",
      position: "",
      location: "",
      date: "",
      summary: "",
      url: { label: "", href: "" },
      keywords: [],
      customFields: [],
    });
  });

  it("shapes an education item", () => {
    expect(emptyItemFor("education")).toEqual({
      id: "",
      visible: true,
      institution: "",
      area: "",
      studyType: "",
      date: "",
      score: "",
      summary: "",
      url: { label: "", href: "" },
      keywords: [],
      customFields: [],
    });
  });

  it("shapes a skill item", () => {
    expect(emptyItemFor("skills")).toEqual({
      id: "",
      visible: true,
      name: "",
      description: "",
      level: 0,
      keywords: [],
      customFields: [],
    });
  });

  it("shapes a project item", () => {
    expect(emptyItemFor("projects")).toEqual({
      id: "",
      visible: true,
      name: "",
      description: "",
      date: "",
      summary: "",
      keywords: [],
      url: { label: "", href: "" },
      customFields: [],
    });
  });

  it("shapes a profile item", () => {
    expect(emptyItemFor("profiles")).toEqual({
      id: "",
      visible: true,
      network: "",
      username: "",
      icon: "",
      url: { label: "", href: "" },
    });
  });

  it("shapes an award item", () => {
    expect(emptyItemFor("awards")).toEqual({
      id: "",
      visible: true,
      title: "",
      awarder: "",
      date: "",
      summary: "",
      url: { label: "", href: "" },
    });
  });

  it("shapes a certification item", () => {
    expect(emptyItemFor("certifications")).toEqual({
      id: "",
      visible: true,
      name: "",
      issuer: "",
      date: "",
      summary: "",
      url: { label: "", href: "" },
    });
  });

  it("shapes a publication item", () => {
    expect(emptyItemFor("publications")).toEqual({
      id: "",
      visible: true,
      name: "",
      publisher: "",
      date: "",
      summary: "",
      url: { label: "", href: "" },
    });
  });

  it("shapes a language item", () => {
    expect(emptyItemFor("languages")).toEqual({
      id: "",
      visible: true,
      name: "",
      description: "",
      level: 0,
    });
  });

  it("shapes an interest item", () => {
    expect(emptyItemFor("interests")).toEqual({
      id: "",
      visible: true,
      name: "",
      keywords: [],
    });
  });

  it("shapes a volunteer item", () => {
    expect(emptyItemFor("volunteer")).toEqual({
      id: "",
      visible: true,
      organization: "",
      position: "",
      location: "",
      date: "",
      summary: "",
      url: { label: "", href: "" },
    });
  });

  it("shapes a reference item", () => {
    expect(emptyItemFor("references")).toEqual({
      id: "",
      visible: true,
      name: "",
      description: "",
      summary: "",
      url: { label: "", href: "" },
    });
  });

  it("shapes a custom item", () => {
    expect(emptyItemFor("speaking")).toEqual({
      id: "",
      visible: true,
      name: "",
      description: "",
      date: "",
      location: "",
      summary: "",
      keywords: [],
      url: { label: "", href: "" },
    });
  });

  it("shapes an unknown id as a custom item", () => {
    expect(emptyItemFor("not-a-section")).toEqual(emptyItemFor("speaking"));
  });

  it("returns null for sections that hold rich text rather than items", () => {
    expect(emptyItemFor("summary")).toBeNull();
    expect(emptyItemFor("coverLetter")).toBeNull();
  });
});

describe("templateDocFontFamily / docFontStack", () => {
  it("uses IBM Plex Serif for nosepass and glalie, Sans for every other template", () => {
    expect(templateDocFontFamily("nosepass")).toBe(NOSEPASS_DOC_FONT_FAMILY);
    expect(templateDocFontFamily("glalie")).toBe(NOSEPASS_DOC_FONT_FAMILY);
    expect(templateDocFontFamily("gengar")).toBe(DEFAULT_DOC_FONT_FAMILY);
    expect(templateDocFontFamily("ditto")).toBe(DEFAULT_DOC_FONT_FAMILY);
    expect(templateDocFontFamily("onyx")).toBe(DEFAULT_DOC_FONT_FAMILY);
    expect(templateDocFontFamily("unknown-template")).toBe(DEFAULT_DOC_FONT_FAMILY);
  });

  it("quotes the family and matches fallback generics to the classification", () => {
    expect(docFontStack("IBM Plex Sans")).toBe('"IBM Plex Sans", Inter, system-ui, sans-serif');
    expect(docFontStack("IBM Plex Serif")).toBe(
      '"IBM Plex Serif", Georgia, "Times New Roman", serif',
    );
  });

  it("sheet CSS consumes --doc-font-* rather than chrome --font-*", () => {
    const css = readFileSync(
      resolve(__dirname, "../../components/doc-editor/docSheet.css"),
      "utf8",
    );
    expect(css).toMatch(/font-family:\s*var\(--doc-font-body\)/);
    expect(css).toMatch(/font-family:\s*var\(--doc-font-display\)/);
    expect(css).not.toMatch(/var\(--font-body\)/);
    expect(css).not.toMatch(/var\(--font-display\)/);
  });

  it("every @font-face url in docFonts.css exists under public/fonts", () => {
    const css = readFileSync(
      resolve(__dirname, "../../components/doc-editor/docFonts.css"),
      "utf8",
    );
    const files = [...css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((match) => match[1]);
    expect(files.length).toBeGreaterThan(0);
    const fontsDir = resolve(__dirname, "../../../public/fonts");
    for (const file of files) {
      expect(existsSync(resolve(fontsDir, file)), file).toBe(true);
    }
  });
});
