import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CUSTOM_SECTION_SENTINEL,
  emptyItemFor,
  FIXED_SECTION_IDS,
  findSectionPlacement,
  isCustomId,
  layoutColumns,
  layoutForTemplate,
  layoutPages,
  nextId,
  renderPages,
  SECTION_LABELS,
  sectionTitle,
  sectionVisible,
  type TemplateLayout,
} from "../docLayout";
import { createEmptyPicture } from "../../wasm/types";
import type { CustomItem, ResumeData, Section, Theme, Typography, Url } from "../../wasm/types";

/**
 * The shared document-editor corpus is stored in the Reactive Resume v3 wire
 * format, which the Rust parser normalizes into `ResumeData`. Vitest cannot run
 * that parser, so the adapter below mirrors it: summary moves out of `basics`,
 * and custom items map `title`/`subtitle` onto `name`/`description`.
 */
// jsdom's `URL` is not a Node file URL, so resolve through the path API.
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../tests/fixtures/v3/doc-editor.json",
);

interface RawSection {
  id: string;
  name: string;
  visible: boolean;
  columns: number;
  items: unknown[];
}

interface RawCustomItem {
  id: string;
  visible: boolean;
  title: string;
  subtitle: string;
  date: string;
  location: string;
  summary: string;
  keywords?: string[];
  url?: Url;
}

interface RawCustomSection extends Omit<RawSection, "items"> {
  items: RawCustomItem[];
}

interface RawFixture {
  basics: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    summary: { body: string; visible: boolean };
    url: Url;
    customFields: { id: string; icon: string; name: string; value: string }[];
  };
  sections: Record<string, RawSection> & { custom: Record<string, RawCustomSection> };
  metadata: {
    template: string;
    layout: string[][][];
    theme: Theme;
    typography: Typography;
  };
}

function toItemSection<T>(raw: RawSection): Section<T> {
  return {
    id: raw.id,
    name: raw.name,
    columns: raw.columns,
    separateLinks: false,
    visible: raw.visible,
    // Fixed-section items already match the wasm item shapes field for field.
    items: raw.items as T[],
  };
}

function toCustomSection(raw: RawCustomSection): Section<CustomItem> {
  return {
    id: raw.id,
    name: raw.name,
    columns: raw.columns,
    separateLinks: false,
    visible: raw.visible,
    items: raw.items.map((item) => ({
      id: item.id,
      visible: item.visible,
      name: item.title,
      description: item.subtitle,
      date: item.date,
      location: item.location,
      summary: item.summary,
      keywords: item.keywords ?? [],
      url: item.url ?? { label: "", href: "" },
    })),
  };
}

/** A fresh `ResumeData` built from the shared document-editor fixture. */
function loadFixture(): ResumeData {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as RawFixture;
  const custom: Record<string, Section<CustomItem>> = {};
  for (const [key, section] of Object.entries(raw.sections.custom)) {
    custom[key] = toCustomSection(section);
  }

  return {
    basics: {
      name: raw.basics.name,
      headline: raw.basics.headline,
      email: raw.basics.email,
      phone: raw.basics.phone,
      location: raw.basics.location,
      url: raw.basics.url,
      customFields: raw.basics.customFields,
      picture: createEmptyPicture(),
    },
    sections: {
      summary: {
        id: "summary",
        name: "Summary",
        columns: 1,
        separateLinks: false,
        visible: raw.basics.summary.visible,
        content: raw.basics.summary.body,
      },
      coverLetter: {
        id: "coverLetter",
        name: "Cover Letter",
        visible: false,
        recipient: { name: "", title: "", company: "", address: "", email: "" },
        content: "",
      },
      experience: toItemSection(raw.sections.experience),
      education: toItemSection(raw.sections.education),
      skills: toItemSection(raw.sections.skills),
      projects: toItemSection(raw.sections.projects),
      profiles: toItemSection(raw.sections.profiles),
      awards: toItemSection(raw.sections.awards),
      certifications: toItemSection(raw.sections.certifications),
      publications: toItemSection(raw.sections.publications),
      languages: toItemSection(raw.sections.languages),
      interests: toItemSection(raw.sections.interests),
      volunteer: toItemSection(raw.sections.volunteer),
      references: toItemSection(raw.sections.references),
      custom,
    },
    metadata: {
      template: raw.metadata.template,
      layout: raw.metadata.layout,
      css: { value: "", visible: false },
      page: { margin: 20, format: "a4", breakLine: true, pageNumbers: true },
      theme: raw.metadata.theme,
      typography: raw.metadata.typography,
      notes: "",
    },
  };
}

/** Mirrors `rhyhorn`: one column holding every section. */
const SINGLE_TEMPLATE: TemplateLayout = {
  layoutMode: "single",
  defaultColumns: [
    [
      "summary",
      "experience",
      "education",
      "awards",
      "certifications",
      "publications",
      "volunteer",
      "projects",
      "references",
      "profiles",
      "skills",
      "interests",
      "languages",
      CUSTOM_SECTION_SENTINEL,
    ],
    [],
  ],
  headerStyle: "center",
  contactIn: "header",
  sidebarWidth: null,
};

/** Mirrors `pikachu`: fixed 180pt sidebar painted on the left. */
const SIDEBAR_TEMPLATE: TemplateLayout = {
  layoutMode: "sidebar-left",
  defaultColumns: [
    [
      "summary",
      "experience",
      "education",
      "awards",
      "certifications",
      "publications",
      "volunteer",
      "projects",
      "references",
      CUSTOM_SECTION_SENTINEL,
    ],
    ["profiles", "skills", "interests", "certifications", "awards", "publications", "languages"],
  ],
  headerStyle: "sidebar",
  contactIn: "sidebar",
  sidebarWidth: 180,
};

/** Mirrors a proportional two-column template with no fixed sidebar width. */
const PROPORTIONAL_TEMPLATE: TemplateLayout = {
  ...SIDEBAR_TEMPLATE,
  layoutMode: "sidebar-right",
  sidebarWidth: null,
};

/** Mirrors `leafish`: a full-width header band above equal (1fr, 1fr) columns. */
const HEADER_SPLIT_TEMPLATE: TemplateLayout = {
  ...SIDEBAR_TEMPLATE,
  layoutMode: "header-split",
  headerStyle: "banner",
  contactIn: "banner",
  sidebarWidth: null,
};

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

describe("renderPages", () => {
  it("drops hidden sections", () => {
    const resume = loadFixture();

    const pages = renderPages(resume, SIDEBAR_TEMPLATE);

    // `advisory` is a custom section with `visible: false`.
    expect(pages[1][1]).toEqual(["languages", "interests", "certifications"]);
  });

  it("drops sections with no content", () => {
    const resume = loadFixture();
    resume.sections.awards.items = [];
    resume.metadata.layout = [[["awards", "experience"]]];

    expect(renderPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"]]]);
  });

  it("drops a section whose items are all hidden", () => {
    const resume = loadFixture();
    resume.sections.publications.items = resume.sections.publications.items.map((item) => ({
      ...item,
      visible: false,
    }));
    resume.metadata.layout = [[["publications", "experience"]]];

    expect(renderPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"]]]);
  });

  it("removes a page left empty by filtering", () => {
    const resume = loadFixture();
    resume.metadata.layout = [[["experience"]], [["references", "advisory"]]];

    expect(renderPages(resume, SIDEBAR_TEMPLATE)).toEqual([[["experience"]]]);
  });

  it("keeps a page that still has content", () => {
    const resume = loadFixture();

    const pages = renderPages(resume, SIDEBAR_TEMPLATE);

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
    expect(columns[1].width).toBeCloseTo(0.3218, 4);
    expect(columns[0].width).toBeCloseTo(1 - columns[1].width, 10);
    // A left sidebar paints before the main column.
    expect(columns[0].order).toBe(1);
    expect(columns[1].order).toBe(0);
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

  it("does not mutate the resume", () => {
    const resume = loadFixture();
    const before = JSON.stringify(resume.metadata.layout);

    layoutForTemplate(resume, SINGLE_TEMPLATE);

    expect(JSON.stringify(resume.metadata.layout)).toBe(before);
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
