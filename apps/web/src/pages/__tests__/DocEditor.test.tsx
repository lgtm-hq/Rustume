import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { render, screen, waitFor, within } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { Suspense, type Component } from "solid-js";
import { axeConfig } from "../../test/a11y";
import { loadDocEditorFixture, SIDEBAR_TEMPLATE } from "../../test/docEditorFixture";
import DocEditor from "../DocEditor";

const { docEditorEnabled, fixture, RESUME_ID } = vi.hoisted(() => ({
  docEditorEnabled: { value: false },
  fixture: { value: null as unknown },
  RESUME_ID: "doc-editor-fixture",
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
  renderPreview: vi.fn().mockResolvedValue(new Blob()),
  downloadPdf: vi.fn().mockResolvedValue(undefined),
}));

// The form editor's preview pane is not what these tests are about.
vi.mock("../../components/preview", () => ({
  Preview: () => <div data-testid="preview-stub">Preview</div>,
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
  history.set({ value: `/edit/${RESUME_ID}`, scroll: false, replace: true });

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

describe("DocEditor sheet", () => {
  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
    docEditorEnabled.value = true;
  });

  async function renderSheet() {
    const result = renderAt(DocEditor);
    await waitFor(() => expect(screen.getByTestId("doc-sheet")).toBeInTheDocument());
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

  it("places every section in the column the stored layout assigns it", async () => {
    await renderSheet();

    const [first, second] = screen.getAllByTestId("doc-sheet-page");

    expect(pageColumns(first)).toEqual([
      // `sidebar-left` paints the sidebar column first.
      ["sidebar", ["profiles", "skills", "speaking"]],
      ["main", ["summary", "experience", "education", "projects"]],
    ]);
    expect(pageColumns(second)).toEqual([
      // `advisory` is placed by the layout but switched off, so it never draws.
      ["sidebar", ["languages", "interests", "certifications"]],
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

  it("renders markdown as-is rather than parsing it", async () => {
    await renderSheet();

    const summary = document.querySelector<HTMLElement>('[data-section-id="summary"]');
    expect(summary?.textContent).toContain("**eleven years**");
    expect(summary?.querySelector("strong")).toBeNull();
  });

  it("renders custom sections under their own names", async () => {
    await renderSheet();

    expect(
      screen.getByRole("heading", { name: "Talks & Workshops", level: 3 }),
    ).toBeInTheDocument();
  });

  it("omits hidden sections", async () => {
    await renderSheet();

    // Both are present in the fixture and switched off — one fixed, one custom.
    expect(document.querySelector('[data-section-id="references"]')).toBeNull();
    expect(screen.queryByRole("heading", { name: "Advisory & Standards Work" })).toBeNull();
  });

  it("offers no editing affordances", async () => {
    const { container } = await renderSheet();
    const sheet = screen.getByTestId("doc-sheet");

    expect(sheet.querySelectorAll("input, textarea, select, button")).toHaveLength(0);
    expect(sheet.querySelectorAll("[contenteditable]")).toHaveLength(0);
    expect(within(container).queryByRole("dialog")).toBeNull();
  });

  it("reports no overflow when nothing is clipped", async () => {
    await renderSheet();

    // jsdom reports zero-height layout, so nothing can be clipped.
    expect(screen.getByTestId("doc-editor-overflow")).toHaveTextContent("");
  });

  it("has no axe violations", async () => {
    const { container } = await renderSheet();

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

describe("/edit/:id route swap", () => {
  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
  });

  it("renders the form editor when the flag is off", async () => {
    docEditorEnabled.value = false;
    const { resolveEditRoute } = await import("../editRoute");

    renderAt(resolveEditRoute());

    await waitFor(() => expect(screen.getByText("Full Name")).toBeInTheDocument(), {
      timeout: 10000,
    });
    expect(screen.queryByTestId("doc-sheet")).toBeNull();
  }, 15000);

  it("renders the document sheet when the flag is on", async () => {
    docEditorEnabled.value = true;
    const { resolveEditRoute } = await import("../editRoute");

    renderAt(resolveEditRoute());

    await waitFor(() => expect(screen.getByTestId("doc-sheet")).toBeInTheDocument(), {
      timeout: 10000,
    });
    expect(screen.queryByText("Full Name")).toBeNull();
  }, 15000);
});
