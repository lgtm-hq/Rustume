import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { uiStore } from "../../stores/ui";
import DocEditor, { isBlankResume } from "../DocEditor";

const { fixture, resumeId } = vi.hoisted(() => ({
  fixture: { value: null as unknown },
  // `resumeStore` is a module singleton and `useResumeRouteLoad` skips the load
  // when the route id already matches what it holds. A fresh id per test forces
  // the reload, so a test that writes through the store cannot leak into the
  // next one's fixture.
  resumeId: { value: "doc-editor-fixture-0" },
}));

// The real modals pull heavy import/export machinery; the toolbar tests only
// verify the buttons mount them, so lightweight stubs stand in.
vi.mock("../../components/import/ImportModal", () => ({
  ImportModal: () => <div data-testid="import-modal-stub" />,
}));

vi.mock("../../components/export/ExportModal", () => ({
  ExportModal: () => <div data-testid="export-modal-stub" />,
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

  it("draws one content-sized sheet per rendered page, with the count pill", async () => {
    await renderSheet();

    const pages = screen.getAllByTestId("doc-sheet-page");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveAttribute("aria-label", "Page 1 of 2");
    expect(pages[1]).toHaveAttribute("aria-label", "Page 2 of 2");
    // The measured page count lives in the sheet's floating pill now (#794);
    // it can never report fewer pages than there are drawn sheets.
    expect(screen.getByTestId("doc-sheet-page-count")).toHaveTextContent(/2\s*pages/);
    expect(
      screen
        .getByTestId("doc-sheet-scale-viewport")
        .querySelector('[data-testid="doc-sheet-page-count"]'),
    ).toBeNull();
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
      // `sidebar-left` paints the sidebar column first. The contact block is
      // template-owned chrome in the sidebar (`contactIn: "sidebar"`).
      ["sidebar", ["basics", "profiles", "skills", "speaking"]],
      // `coverLetter` and `references` are back-filled by normalization
      // (#770) but hidden, and hidden sections never draw (#794).
      ["main", ["summary", "experience", "education", "projects"]],
    ]);
    expect(pageColumns(second)).toEqual([
      // `advisory` is switched off, so it is absent from the surface (#794).
      ["sidebar", ["languages", "interests", "certifications"]],
      ["main", ["publications", "volunteer", "awards"]],
    ]);
  });

  it("renders the header in the sidebar for a sidebar-header template", async () => {
    await renderSheet();

    const [first] = screen.getAllByTestId("doc-sheet-page");
    const sidebar = first.querySelector<HTMLElement>('[data-column-role="sidebar"]');
    const header = within(sidebar as HTMLElement).getByTestId("doc-sheet-header");

    expect(within(header).getByRole("heading", { name: "Mireille Okafor" })).toBeInTheDocument();
    expect(header).toHaveTextContent("Principal Design Systems Engineer");
    // `contactIn: "sidebar"` — the contact block prints in the sidebar too.
    const contact = within(sidebar as HTMLElement).getByTestId("doc-sheet-contact");
    expect(contact).toHaveTextContent("mireille@okafor.design");
    expect(contact).toHaveTextContent("Lisbon, Portugal");
    // Custom fields keep their labels.
    expect(contact).toHaveTextContent("Pronouns:");
  });

  it("renders item fields in the order the Typst templates present them", async () => {
    await renderSheet();

    const experience = document.querySelector<HTMLElement>('[data-section-id="experience"]');
    const first = within(experience as HTMLElement).getAllByRole("article")[0];

    // Spec §1.7: position over the company · date meta row, then location.
    expect(first.textContent).toMatch(
      /Principal Design Systems Engineer.*Lumen Health.*March 2022 - Present.*Lisbon, Portugal \(Remote\)/s,
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

  it("renders each profile as one compact icon row, not stacked duplicates", async () => {
    await renderSheet();

    // Spec §1.7: brand glyph plus username-or-network as a single link — no
    // second text run repeating the network or the URL.
    const profiles = document.querySelector<HTMLElement>('[data-section-id="profiles"]');
    const entries = within(profiles as HTMLElement).getAllByRole("article");
    expect(entries).toHaveLength(3);
    for (const entry of entries) {
      expect(entry.querySelectorAll(".doc-sheet__side-link")).toHaveLength(1);
      expect(entry.querySelector(".doc-sheet__icon-row svg")).not.toBeNull();
    }
  });

  it("edits a profile through its dialog — the whole compact row is the affordance", async () => {
    await renderSheet();

    const profiles = document.querySelector<HTMLElement>('[data-section-id="profiles"]');
    const first = within(profiles as HTMLElement).getAllByRole("article")[0];
    expect(first).toHaveAttribute("title", "Click to edit · hold to drag");

    fireEvent.click(first);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("textbox", { name: "Network" })).toHaveValue("GitHub");
    expect(within(dialog).getByRole("textbox", { name: "Username" })).toHaveValue("mireilleokafor");
  });

  it("renders custom sections under their own names", async () => {
    await renderSheet();

    expect(
      screen.getByRole("heading", { name: "Talks & Workshops", level: 3 }),
    ).toBeInTheDocument();
  });

  it("never draws hidden sections — the Sections panel is the recovery path", async () => {
    await renderSheet();

    // `advisory` is placed and switched off; `references` is back-filled by
    // normalization (#770) but hidden. Hidden sections never draw (#794) —
    // they are toggled back on from the Sections panel, exactly as for the
    // rendered document.
    expect(document.querySelector('[data-section-id="advisory"]')).toBeNull();
    expect(document.querySelector('[data-section-id="references"]')).toBeNull();
  });

  it("keeps entry editing keyboard-reachable without any in-place editor", async () => {
    await renderSheet();
    const sheet = screen.getByTestId("doc-sheet");

    // Modal editing (owner decision 2026-08-04): entry values are plain
    // rendered text; the keyboard path to the item modal is the row's Edit
    // action, nothing is contenteditable, and no dialog is open until the
    // user asks for one.
    const experience = sheet.querySelector<HTMLElement>('[data-section-id="experience"]');
    expect(within(experience as HTMLElement).getByText("Lumen Health")).toBeInTheDocument();
    expect(
      within(experience as HTMLElement).getAllByRole("button", { name: /^Edit / }).length,
    ).toBeGreaterThan(0);
    expect(sheet.querySelectorAll("[contenteditable]")).toHaveLength(0);
    // Modal portals mount outside the render container, so the "no dialog
    // open" check must query the whole document.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("edits an entry through its modal and writes it through the store", async () => {
    await renderSheet();
    const sheet = screen.getByTestId("doc-sheet");
    const experience = sheet.querySelector<HTMLElement>('[data-section-id="experience"]');

    fireEvent.dblClick(
      (experience as HTMLElement).querySelector(".doc-sheet__entry-row") as HTMLElement,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit · Experience" });
    fireEvent.input(within(dialog).getByRole("textbox", { name: "Company" }), {
      target: { value: "Lumen Health Group" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // The store is the real one here, so the sheet redraws from what it holds.
    await waitFor(() =>
      expect(within(experience as HTMLElement).getByText("Lumen Health Group")).toBeInTheDocument(),
    );
  });

  it("draws no A4 overflow guides while content fits a page", async () => {
    await renderSheet();

    // Sheets size to content and overflow is signalled by dashed guides at
    // 1122px intervals (#794); jsdom reports zero-height layout, so no sheet
    // can exceed a page.
    expect(document.querySelectorAll(".doc-sheet__page-guide")).toHaveLength(0);
  });

  it("drives the Templates drawer from its surface edge tab, not the top bar", async () => {
    await renderSheet();

    // Owner decision 2026-08-04: the panels are not top-bar items.
    const topBar = screen.getByTestId("doc-editor-topbar");
    expect(within(topBar).queryByRole("button", { name: "Templates" })).toBeNull();
    expect(within(topBar).queryByRole("button", { name: "Sections" })).toBeNull();

    const tab = screen.getByTestId("doc-editor-templates-tab");
    expect(tab).toHaveTextContent("Templates");
    expect(tab).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(tab);

    expect(await screen.findByRole("dialog", { name: /Templates/ })).toBeInTheDocument();
    expect(tab).toHaveAttribute("aria-expanded", "true");
  });

  it("drives the Sections panel from its surface edge tab", async () => {
    await renderSheet();

    const tab = screen.getByTestId("doc-editor-sections-tab");
    expect(tab).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(tab);

    expect(await screen.findByRole("dialog", { name: /Sections/ })).toBeInTheDocument();
    expect(screen.getByTestId("sections-panel")).toBeInTheDocument();
    expect(tab).toHaveAttribute("aria-expanded", "true");
  });

  it("opens theme selection from the top bar", async () => {
    await renderSheet();

    // Spec §1.2 (owner addition): theme selection is a top-bar control.
    const topBar = screen.getByTestId("doc-editor-topbar");
    fireEvent.click(within(topBar).getByRole("button", { name: "Theme" }));

    expect(await screen.findByRole("dialog", { name: /Theme/ })).toBeInTheDocument();
    expect(screen.getByTestId("theme-dialog")).toBeInTheDocument();
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
      // FALLBACK_TEMPLATE_LAYOUT is single-column: one continuous section
      // list with the identity banner at its top, and no sidebar at all.
      expect(first.querySelector(".doc-sheet__single")).toBeTruthy();
      expect(first.querySelector('[data-column-role="sidebar"]')).toBeFalsy();
      expect(within(first).getByTestId("doc-sheet-header")).toBeInTheDocument();
    });
  });

  it("falls back to a single-column layout when the template request fails", async () => {
    const { fetchTemplateLayouts } = await import("../../api/render");
    vi.mocked(fetchTemplateLayouts).mockRejectedValueOnce(new Error("offline"));

    await renderSheet();

    await waitFor(() => {
      const [first] = screen.getAllByTestId("doc-sheet-page");
      expect(first.querySelector(".doc-sheet__single")).toBeTruthy();
      expect(first.querySelector('[data-column-role="sidebar"]')).toBeFalsy();
    });
  });
});

describe("Edit/Done toggle", () => {
  let renderCount = 0;

  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
    resumeId.value = `doc-editor-mode-${++renderCount}`;
  });

  // uiStore is a module-level singleton: a modal left open by a failed
  // assertion would leak into every later test in the file.
  afterEach(() => {
    uiStore.closeModal();
  });

  it("opens an existing resume as the clean rendered document", async () => {
    await renderEditor();

    await waitFor(() => expect(sheetMode()).toBe("done"));
    // The toggle offers the way in: its label is the action it performs.
    expect(screen.getByTestId("doc-editor-mode-toggle")).toHaveTextContent("Edit");
  });

  it("opens the import modal from the top bar", async () => {
    await renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    await waitFor(() => expect(screen.getByTestId("import-modal-stub")).toBeInTheDocument());
  });

  it("opens the export modal from the top bar", async () => {
    await renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(screen.getByTestId("export-modal-stub")).toBeInTheDocument());
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

describe("/edit/:id route", () => {
  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
  });

  it("renders the document sheet unconditionally (#735)", async () => {
    renderAt(DocEditor);

    await waitFor(() => expect(screen.getByTestId("doc-sheet")).toBeInTheDocument(), {
      timeout: 10000,
    });
    // The form builder is gone: no basics form ever mounts on this route.
    expect(screen.queryByText("Full Name")).toBeNull();
  }, 15000);
});
