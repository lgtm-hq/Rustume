/**
 * The shared document-editor corpus, as `ResumeData`.
 *
 * `tests/fixtures/v3/doc-editor.json` is stored in the Reactive Resume v3 wire
 * format, which the Rust parser normalizes into `ResumeData`. Vitest cannot run
 * that parser, so the adapter below mirrors it: summary moves out of `basics`,
 * and custom items map `title`/`subtitle` onto `name`/`description`.
 *
 * The template constants mirror real bundled templates so tests exercise the
 * same layout metadata `GET /api/templates` serves.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { CUSTOM_SECTION_SENTINEL, type TemplateLayout } from "../lib/docLayout";
import { createEmptyPicture } from "../wasm/types";
import type { CustomItem, ResumeData, Section, Theme, Typography, Url } from "../wasm/types";

// jsdom's `URL` is not a Node file URL, so resolve through the path API.
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/v3/doc-editor.json",
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
export function loadDocEditorFixture(): ResumeData {
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
      // The corpus's rich fields are authored in markdown; without the stamp
      // the doc editor would treat the fixture as legacy HTML and migrate it
      // on open (#786), which has its own dedicated tests.
      contentFormat: "markdown",
    },
  };
}

/**
 * Flip a mounted `DocEditor` into Edit mode via the top-bar toggle.
 *
 * The corpus resume is not empty, so the surface settles in Done mode first
 * (#785); tests that edit in place share this sequence instead of each
 * re-implementing the wait-toggle-wait dance.
 */
export async function enterEditMode(): Promise<void> {
  const mode = () => screen.getByTestId("doc-sheet").getAttribute("data-sheet-mode");
  await waitFor(() => expect(mode()).toBe("done"));
  fireEvent.click(screen.getByTestId("doc-editor-mode-toggle"));
  await waitFor(() => expect(mode()).toBe("edit"));
}

/** Mirrors `rhyhorn`: one column holding every section. */
export const SINGLE_TEMPLATE: TemplateLayout = {
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
export const SIDEBAR_TEMPLATE: TemplateLayout = {
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
export const PROPORTIONAL_TEMPLATE: TemplateLayout = {
  ...SIDEBAR_TEMPLATE,
  layoutMode: "sidebar-right",
  sidebarWidth: null,
};

/** Mirrors `leafish`: a full-width header band above equal (1fr, 1fr) columns. */
export const HEADER_SPLIT_TEMPLATE: TemplateLayout = {
  ...SIDEBAR_TEMPLATE,
  layoutMode: "header-split",
  headerStyle: "banner",
  contactIn: "banner",
  sidebarWidth: null,
};
