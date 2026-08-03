import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { Suspense, type Component } from "solid-js";
import { axeConfig } from "../../test/a11y";
import {
  enterEditMode,
  loadBlankDocEditorFixture,
  loadDocEditorFixture,
  SIDEBAR_TEMPLATE,
} from "../../test/docEditorFixture";
import { resumeStore } from "../../stores/resume";
import DocEditor, { isBlankResume } from "../DocEditor";

const { docEditorEnabled, fixture, resumeId } = vi.hoisted(() => ({
  docEditorEnabled: { value: false },
  fixture: { value: null as unknown },
  // `resumeStore` is a module singleton and `useResumeRouteLoad` skips the load
  // when the route id already matches what it holds. A fresh id per test forces
  // the reload, so a test that writes through the store cannot leak into the
  // next one's fixture.
  resumeId: { value: "doc-editor-fixture-0" },
}));

vi.mock("../../lib/flags", () => ({
  isDocEditorEnabled: () => docEditorEnabled.value,
}));

vi.mock("../../wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../wasm")>();
  return {
    ...actual,
    getResume: vi.fn(() => Promise.resolve(fixture.value)),
    isWasmReady: () => true,
    ensureWasmReady: async () => true,
    saveResume: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../api/render", () => ({
  fetchTemplateLayouts: vi.fn(() => Promise.resolve({ ditto: SIDEBAR_TEMPLATE })),
  fetchTemplates: vi.fn(() =>
    Promise.resolve([
      {
        id: "ditto",
        name: "Ditto",
        theme: { background: "#ffffff", text: "#1c1917", primary: "#7c3aed" },
        layout: SIDEBAR_TEMPLATE,
      },
    ]),
  ),
  getTemplateThumbnailUrl: vi.fn((id: string) => `/api/templates/${id}/thumbnail`),
  renderPreview: vi.fn().mockResolvedValue(new Blob()),
  downloadPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../stores/auth", () => ({
  authStore: {
    get state() {
      return { loading: false, cloudEnabled: false, requireAuth: false, user: null };
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    displayName: () => "User",
  },
}));

function renderAt(component: Component) {
  const history = createMemoryHistory();
  history.set({ value: `/edit/${resumeId.value}`, scroll: false, replace: true });

  return render(() => (
    <Suspense fallback={<p>Loading route</p>}>
      <MemoryRouter history={history}>
        <Route path="/edit/:id" component={component} />
      </MemoryRouter>
    </Suspense>
  ));
}

/** Sections drawn on `page`, in column order, as `[columnRole, sectionIds]`. */
function pageColumns(page: HTMLElement): [string, string[]][] {
  return [...page.querySelectorAll<HTMLElement>(".doc-sheet__column")].map((column) => [
    column.dataset.columnRole ?? "",
    [...column.querySelectorAll<HTMLElement>("[data-section-id]")].map(
      (section) => section.dataset.sectionId ?? "",
    ),
  ]);
}

function sheetMode(): string {
  return screen.getByTestId("doc-sheet").getAttribute("data-sheet-mode") ?? "";
}

/** Mount the editor at the current fixture id and wait for the sheet. */
async function renderEditor() {
  const result = renderAt(DocEditor);
  await waitFor(() => expect(screen.getByTestId("doc-sheet")).toBeInTheDocument());
  return result;
}

describe("DocEditor sheet", () => {
  let renderCount = 0;

  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
    docEditorEnabled.value = true;
    resumeId.value = `doc-editor-fixture-${++renderCount}`;
  });

  /**
   * Mount the editor and wait for the sheet.
   *
   * The corpus resume is not empty, so the surface settles in Done mode;
   * `mode: "edit"` flips the top-bar toggle afterwards, the way a user would.
   */
  async function renderSheet(options: { mode: "edit" | "done" } = { mode: "edit" }) {
    const result = await renderEditor();
    if (options.mode === "edit") {
      await enterEditMode();
    } else {
      await waitFor(() => expect(sheetMode()).toBe("done"));
    }
    return result;
  }

  it("draws one A4 page frame per rendered page", async () => {
    await renderSheet();

    const pages = screen.getAllByTestId("doc-sheet-page");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveAttribute("aria-label", "Page 1 of 2");
    expect(pages[1]).toHaveAttribute("aria-label", "Page 2 of 2");
    expect(screen.getByTestId("doc-editor-page-count")).toHaveTextContent("2 pages");
  });

  it("renders a single document surface with no preview pane", async () => {
    await renderSheet({ mode: "done" });

    // #785: the sheet is the one document on screen. The server render only
    // exists behind the Export dialog now.
    expect(screen.getByTestId("doc-editor-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("doc-editor-preview-pane")).toBeNull();
    expect(screen.queryByTestId("doc-editor-sheet-pane")).toBeNull();
  });

  it("places every section in the column the stored layout assigns it", async () => {
    await renderSheet();

    const [first, second] = screen.getAllByTestId("doc-sheet-page");

    expect(pageColumns(first)).toEqual([
      // `sidebar-left` paints the sidebar column first.
      ["sidebar", ["profiles", "skills", "speaking"]],
      // `coverLetter` and `references` are absent from the stored layout, so
      // normalization back-fills them into the first main column (#770).
      ["main", ["summary", "experience", "education", "projects", "coverLetter", "references"]],
    ]);
    expect(pageColumns(second)).toEqual([
      // `advisory` is switched off but stays drawn as chrome (see below).
      ["sidebar", ["languages", "interests", "certifications", "advisory"]],
      ["main", ["publications", "volunteer", "awards"]],
    ]);
  });

  it("renders the header in the sidebar for a sidebar-header template", async () => {
    await renderSheet();

    const [first] = screen.getAllByTestId("doc-sheet-page");
    const sidebar = first.querySelector<HTMLElement>(".doc-sheet__column--sidebar");
    const header = within(sidebar as HTMLElement).getByTestId("doc-sheet-header");

    expect(within(header).getByRole("heading", { name: "Mireille Okafor" })).toBeInTheDocument();
    expect(header).toHaveTextContent("Principal Design Systems Engineer");
    // `contactIn: "sidebar"` — contact details print alongside the name block.
    expect(header).toHaveTextContent("mireille@okafor.design");
    expect(header).toHaveTextContent("Lisbon, Portugal");
    // Custom fields keep their labels.
    expect(header).toHaveTextContent("Pronouns:");
  });

  it("renders item fields in the order the Typst templates present them", async () => {
    await renderSheet();

    const experience = document.querySelector<HTMLElement>('[data-section-id="experience"]');
    const first = within(experience as HTMLElement).getAllByRole("article")[0];

    expect(first.textContent).toMatch(
      /Lumen Health.*Principal Design Systems Engineer.*March 2022 - Present.*Lisbon, Portugal \(Remote\)/s,
    );
  });

  it("renders markdown formatted rather than as raw punctuation", async () => {
    await renderSheet();

    // The sheet is the rendered document (#785): `**eleven years**` draws as
    // bold text, not as literal asterisks.
    const summary = document.querySelector<HTMLElement>('[data-section-id="summary"]');
    expect(summary?.querySelector("strong")?.textContent).toBe("eleven years");
    expect(summary?.textContent).not.toContain("**");
  });

  it("renders each profile as one entry, not stacked duplicates", async () => {
    await renderSheet();

    // #787: network label plus username on one line — no third text run
    // repeating the URL.
    const profiles = document.querySelector<HTMLElement>('[data-section-id="profiles"]');
    const entries = within(profiles as HTMLElement).getAllByRole("article");
    for (const entry of entries) {
      expect(entry.querySelector(".doc-sheet__item-inline")).not.toBeNull();
      expect(entry.querySelector(".doc-sheet__item-subtitle")).toBeNull();
      expect(entry.querySelector(".doc-sheet__url")).toBeNull();
    }
  });

  it("keeps profile fields individually editable", async () => {
    await renderSheet();

    const profiles = document.querySelector<HTMLElement>('[data-section-id="profiles"]');
    const first = within(profiles as HTMLElement).getAllByRole("article")[0];
    const buttons = [...first.querySelectorAll<HTMLButtonElement>(".doc-sheet__editable")];

    // One editable slot for the network, one for the username.
    expect(buttons.map((button) => button.title)).toEqual(
      expect.arrayContaining(["Edit network", "Edit username"]),
    );
  });

  it("renders custom sections under their own names", async () => {
    await renderSheet();

    expect(
      screen.getByRole("heading", { name: "Talks & Workshops", level: 3 }),
    ).toBeInTheDocument();
  });

  it("keeps hidden sections on the surface as flagged chrome", async () => {
    await renderSheet();

    // `advisory` is placed and switched off: hidden means "not rendered to
    // PDF", not "gone from the editing surface" — the section stays drawn,
    // dimmed and flagged, so it can be shown again from the sheet.
    const advisory = document.querySelector('[data-section-id="advisory"]');
    expect(advisory).not.toBeNull();
    expect(advisory?.classList.contains("doc-sheet__section--hidden")).toBe(true);
    // A section the stored layout never placed is back-filled by
    // normalization (#770), so it surfaces as hidden chrome too instead of
    // being silently unreachable from the sheet.
    const references = document.querySelector('[data-section-id="references"]');
    expect(references).not.toBeNull();
    expect(references?.classList.contains("doc-sheet__section--hidden")).toBe(true);
  });

  it("offers every drawn value as a keyboard-reachable editing affordance", async () => {
    const { container } = await renderSheet();
    const sheet = screen.getByTestId("doc-sheet");

    // #728 replaced the read-only sheet: values are buttons that swap for an
    // input in place. What must stay true is that nothing is click-only and
    // that no dialog is open until the user asks for one.
    const experience = sheet.querySelector<HTMLElement>('[data-section-id="experience"]');
    expect(
      within(experience as HTMLElement).getByRole("button", { name: "Lumen Health" }),
    ).toBeInTheDocument();
    expect(sheet.querySelectorAll("[contenteditable]")).toHaveLength(0);
    expect(within(container).queryByRole("dialog")).toBeNull();
  });

  it("edits a value in place and writes it through the store", async () => {
    await renderSheet();
    const sheet = screen.getByTestId("doc-sheet");
    const experience = sheet.querySelector<HTMLElement>('[data-section-id="experience"]');

    fireEvent.click(
      within(experience as HTMLElement).getByRole("button", { name: "Lumen Health" }),
    );
    const input = within(experience as HTMLElement).getByRole("textbox", { name: "Company" });
    fireEvent.input(input, { target: { value: "Lumen Health Group" } });
    fireEvent.blur(input);

    // The store is the real one here, so the sheet redraws from what it holds.
    await waitFor(() =>
      expect(
        within(experience as HTMLElement).getByRole("button", { name: "Lumen Health Group" }),
      ).toBeInTheDocument(),
    );
  });

  it("reports no overflow when nothing is clipped", async () => {
    await renderSheet();

    // jsdom reports zero-height layout, so nothing can be clipped.
    expect(screen.getByTestId("doc-editor-overflow")).toHaveTextContent("");
  });

  it("has no axe violations in Edit mode", async () => {
    const { container } = await renderSheet();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  }, 15000);

  it("has no axe violations in Done mode", async () => {
    const { container } = await renderSheet({ mode: "done" });

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  }, 15000);

  it("falls back to a single-column layout when template metadata is unavailable", async () => {
    const { fetchTemplateLayouts } = await import("../../api/render");
    vi.mocked(fetchTemplateLayouts).mockResolvedValueOnce({});

    await renderSheet();

    await waitFor(() => {
      const [first] = screen.getAllByTestId("doc-sheet-page");
      // The stored layout still supplies two columns; only the geometry and the
      // header placement come from the template.
      expect(first.querySelector(".doc-sheet__column")).toBeTruthy();
      expect(first.querySelector(".doc-sheet__header")).toBeTruthy();
      // FALLBACK_TEMPLATE_LAYOUT declares headerStyle "left" / contactIn
      // "header", so the header must sit above the columns rather than inside
      // the sidebar the way SIDEBAR_TEMPLATE places it.
      expect(first.querySelector(".doc-sheet__column .doc-sheet__header")).toBeFalsy();
    });
  });

  it("falls back to a single-column layout when the template request fails", async () => {
    const { fetchTemplateLayouts } = await import("../../api/render");
    vi.mocked(fetchTemplateLayouts).mockRejectedValueOnce(new Error("offline"));

    await renderSheet();

    await waitFor(() => {
      const [first] = screen.getAllByTestId("doc-sheet-page");
      expect(first.querySelector(".doc-sheet__column")).toBeTruthy();
      expect(first.querySelector(".doc-sheet__column .doc-sheet__header")).toBeFalsy();
    });
  });
});

describe("Edit/Done toggle", () => {
  let renderCount = 0;

  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
    docEditorEnabled.value = true;
    resumeId.value = `doc-editor-mode-${++renderCount}`;
  });

  it("opens an existing resume as the clean rendered document", async () => {
    await renderEditor();

    await waitFor(() => expect(sheetMode()).toBe("done"));
    // The toggle offers the way in: its label is the action it performs.
    expect(screen.getByTestId("doc-editor-mode-toggle")).toHaveTextContent("Edit");
  });

  it("keeps the blank fixture in lockstep with the blank-resume detector", () => {
    // If either side drifts, this fails with a clear message instead of a
    // confusing mode assertion in the test below.
    expect(isBlankResume(loadBlankDocEditorFixture())).toBe(true);
    expect(isBlankResume(loadDocEditorFixture())).toBe(false);
  });

  it("opens a brand-new empty resume ready to type", async () => {
    fixture.value = loadBlankDocEditorFixture();

    await renderEditor();

    await waitFor(() => expect(sheetMode()).toBe("edit"));
    expect(screen.getByTestId("doc-editor-mode-toggle")).toHaveTextContent("Done");
  });

  it("draws Done mode as a document, not a form with hidden chrome", async () => {
    await renderEditor();
    await waitFor(() => expect(sheetMode()).toBe("done"));
    const sheet = screen.getByTestId("doc-sheet");

    // No editing affordances of any kind: no editable buttons, no add
    // buttons, no move/hide/delete chrome, no placeholders for empty fields.
    expect(sheet.querySelectorAll(".doc-sheet__editable")).toHaveLength(0);
    expect(sheet.querySelectorAll(".doc-sheet__action")).toHaveLength(0);
    expect(sheet.querySelectorAll(".doc-sheet__section-chrome")).toHaveLength(0);
    expect(sheet.querySelectorAll(".doc-sheet__item-actions")).toHaveLength(0);
    expect(within(sheet).queryByText("Add section")).toBeNull();
    // The fixture's phone is empty: Edit mode offers it as a placeholder,
    // the rendered document simply does not print it.
    expect(within(sheet).queryByText("Add phone")).toBeNull();

    // Hidden sections are dropped exactly as the PDF drops them.
    expect(sheet.querySelector('[data-section-id="advisory"]')).toBeNull();
    expect(sheet.querySelector('[data-section-id="references"]')).toBeNull();
  });

  it("round-trips between the two modes", async () => {
    await renderEditor();
    await waitFor(() => expect(sheetMode()).toBe("done"));

    fireEvent.click(screen.getByTestId("doc-editor-mode-toggle"));
    await waitFor(() => expect(sheetMode()).toBe("edit"));
    expect(
      screen.getByTestId("doc-sheet").querySelectorAll(".doc-sheet__editable").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("doc-editor-mode-toggle"));
    await waitFor(() => expect(sheetMode()).toBe("done"));
    expect(screen.getByTestId("doc-sheet").querySelectorAll(".doc-sheet__editable")).toHaveLength(
      0,
    );
  });
});

describe("legacy HTML migration (#786)", () => {
  let renderCount = 0;

  beforeEach(() => {
    docEditorEnabled.value = true;
    resumeId.value = `doc-editor-migration-${++renderCount}`;

    const legacy = loadDocEditorFixture();
    delete legacy.metadata.contentFormat;
    legacy.sections.summary.content =
      "<p>Automation and platform engineer with <strong>eleven years</strong> of experience.</p>";
    legacy.sections.experience.items[0].summary =
      "<ul><li><p>Led the <em>design system</em> programme</p></li></ul>";
    fixture.value = legacy;
  });

  it("shows formatted text, never raw tags, when opening a legacy resume", async () => {
    await renderEditor();

    await waitFor(() => {
      const summary = document.querySelector<HTMLElement>('[data-section-id="summary"]');
      expect(summary?.textContent).toContain("eleven years");
      expect(summary?.textContent).not.toContain("<p>");
      expect(summary?.textContent).not.toContain("<strong>");
      expect(summary?.querySelector("strong")?.textContent).toBe("eleven years");
    });
  });

  it("converts the stored content once and stamps contentFormat", async () => {
    await renderEditor();

    await waitFor(() => {
      expect(resumeStore.store.resume?.metadata.contentFormat).toBe("markdown");
    });
    expect(resumeStore.store.resume?.sections.summary.content).toBe(
      "Automation and platform engineer with **eleven years** of experience.",
    );
    expect(resumeStore.store.resume?.sections.experience.items[0].summary).toBe(
      "- Led the *design system* programme",
    );
    // The migrated form persists through the normal autosave path.
    expect(resumeStore.store.isDirty).toBe(true);
  });

  it("leaves an already-migrated resume untouched", async () => {
    const migrated = loadDocEditorFixture();
    const summary = migrated.sections.summary.content;
    fixture.value = migrated;

    await renderEditor();

    await waitFor(() => expect(resumeStore.store.resume).not.toBeNull());
    expect(resumeStore.store.resume?.sections.summary.content).toBe(summary);
    expect(resumeStore.store.isDirty).toBe(false);
  });
});

describe("/edit/:id route swap", () => {
  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
  });

  it("renders the form editor when the form-builder override is active", async () => {
    docEditorEnabled.value = false;
    const { resolveEditRoute } = await import("../editRoute");

    renderAt(resolveEditRoute());

    await waitFor(() => expect(screen.getByText("Full Name")).toBeInTheDocument(), {
      timeout: 10000,
    });
    expect(screen.queryByTestId("doc-sheet")).toBeNull();
  }, 15000);

  it("renders the document sheet by default", async () => {
    docEditorEnabled.value = true;
    const { resolveEditRoute } = await import("../editRoute");

    renderAt(resolveEditRoute());

    await waitFor(() => expect(screen.getByTestId("doc-sheet")).toBeInTheDocument(), {
      timeout: 10000,
    });
    expect(screen.queryByText("Full Name")).toBeNull();
  }, 15000);
});
