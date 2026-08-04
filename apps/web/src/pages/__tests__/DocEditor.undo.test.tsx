/**
 * Undo, autosave, and version history on the document editor (#730).
 *
 * The sheet mutates only through `resumeStore` actions (see
 * `doc-editor/__tests__/storeContract.test.ts`), so every edit made here runs
 * the real store, the real `undoHistory` debounce, and the real autosave
 * timer. These tests prove the invariant end to end: what the surface edits,
 * the toolbar and hotkeys can take back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { Suspense, type Component } from "solid-js";
import { enterEditMode, loadDocEditorFixture, SIDEBAR_TEMPLATE } from "../../test/docEditorFixture";
import DocEditor from "../DocEditor";

const { docEditorEnabled, fixture, resumeId } = vi.hoisted(() => ({
  docEditorEnabled: { value: true },
  fixture: { value: null as unknown },
  // A fresh id per test forces `useResumeRouteLoad` to reload, which runs
  // `clearUndoHistory` — so each test starts with an empty undo stack.
  resumeId: { value: "doc-editor-undo-0" },
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
  renderPreview: vi.fn().mockResolvedValue({ url: "blob:preview", totalPages: 1 }),
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

/** The undoHistory debounce window plus a step. */
const DEBOUNCE_MS = 600;
/** The resume store's autosave delay plus a step. */
const SAVE_DELAY_MS = 1100;

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

/** The section ids drawn in the first page's main column, in order. */
function mainColumnSections(): string[] {
  const [first] = screen.getAllByTestId("doc-sheet-page");
  const main = first.querySelector<HTMLElement>('[data-column-role="main"]');
  return [...(main?.querySelectorAll<HTMLElement>("[data-section-id]") ?? [])].map(
    (section) => section.dataset.sectionId ?? "",
  );
}

function experienceSection(): HTMLElement {
  const sheet = screen.getByTestId("doc-sheet");
  return sheet.querySelector<HTMLElement>('[data-section-id="experience"]') as HTMLElement;
}

/** Commit a company edit through the entry's item modal (double-click row). */
function editCompany(currentLabel: string, value: string) {
  const row = [...experienceSection().querySelectorAll<HTMLElement>(".doc-sheet__entry-row")].find(
    (each) => each.textContent?.includes(currentLabel),
  ) as HTMLElement;
  fireEvent.dblClick(row);
  const dialog = screen.getByRole("dialog", { name: "Edit · Experience" });
  fireEvent.input(within(dialog).getByRole("textbox", { name: "Company" }), {
    target: { value },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
}

function undoButton(): HTMLElement {
  return screen.getByRole("button", { name: "Undo" });
}

function redoButton(): HTMLElement {
  return screen.getByRole("button", { name: "Redo" });
}

async function settleDebounce(ms = DEBOUNCE_MS) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe("DocEditor undo, autosave, and version history", () => {
  let renderCount = 0;

  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
    docEditorEnabled.value = true;
    resumeId.value = `doc-editor-undo-${++renderCount}`;
  });

  afterEach(async () => {
    vi.useRealTimers();
    const { uiStore } = await import("../../stores/ui");
    uiStore.closeModal();
  });

  /** Render the page with real timers, then hand the clock to the test. */
  async function renderSheet() {
    const result = renderAt(DocEditor);
    await waitFor(() => expect(screen.getByTestId("doc-sheet")).toBeInTheDocument());
    // The corpus resume opens as the rendered document (#785); every test
    // here edits in place, so flip the top-bar toggle into Edit mode first.
    await enterEditMode();
    vi.useFakeTimers();
    return result;
  }

  it("starts with undo and redo disabled", async () => {
    await renderSheet();

    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();
  });

  it("round-trips an inline text edit through the toolbar buttons", async () => {
    await renderSheet();
    const section = experienceSection();

    fireEvent.dblClick(section.querySelector(".doc-sheet__entry-row") as HTMLElement);
    const dialog = screen.getByRole("dialog", { name: "Edit · Experience" });
    fireEvent.input(within(dialog).getByRole("textbox", { name: "Company" }), {
      target: { value: "Lumen Health Group" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await settleDebounce();

    expect(undoButton()).not.toBeDisabled();
    fireEvent.click(undoButton());
    expect(within(experienceSection()).getByText("Lumen Health")).toBeInTheDocument();

    expect(redoButton()).not.toBeDisabled();
    fireEvent.click(redoButton());
    expect(within(experienceSection()).getByText("Lumen Health Group")).toBeInTheDocument();
  });

  it("round-trips an item add through the add dialog", async () => {
    await renderSheet();

    fireEvent.click(within(experienceSection()).getByRole("button", { name: "Add experience" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.input(within(dialog).getByRole("textbox", { name: "Company" }), {
      target: { value: "Aster Labs" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await settleDebounce();

    expect(within(experienceSection()).getByText("Aster Labs")).toBeInTheDocument();

    fireEvent.click(undoButton());
    expect(within(experienceSection()).queryByText("Aster Labs")).toBeNull();

    fireEvent.click(redoButton());
    expect(within(experienceSection()).getByText("Aster Labs")).toBeInTheDocument();
  });

  it("round-trips a section move as a single undo entry", async () => {
    await renderSheet();
    const before = mainColumnSections();
    // `coverLetter` and `references` are back-filled by normalization (#770)
    // but hidden, and hidden sections never draw (#794).
    const moved = ["summary", "education", "experience", "projects"];
    expect(before).toEqual(["summary", "experience", "education", "projects"]);

    // The structural actions live in the section's pencil menu (#794).
    fireEvent.click(screen.getByRole("button", { name: "Experience section options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move Experience section down" }));
    await settleDebounce();
    expect(mainColumnSections()).toEqual(moved);

    fireEvent.click(undoButton());
    expect(mainColumnSections()).toEqual(before);

    fireEvent.click(redoButton());
    expect(mainColumnSections()).toEqual(moved);
  });

  it("collapses a rapid edit burst into one undo entry", async () => {
    await renderSheet();

    editCompany("Lumen Health", "Lumen A");
    // Well inside the 500 ms debounce window — same burst.
    await settleDebounce(100);
    editCompany("Lumen A", "Lumen AB");
    await settleDebounce();

    fireEvent.click(undoButton());
    expect(within(experienceSection()).getByText("Lumen Health")).toBeInTheDocument();
    expect(undoButton()).toBeDisabled();
  });

  it("undoes and redoes through the keyboard shortcuts", async () => {
    await renderSheet();
    const section = experienceSection();

    fireEvent.dblClick(section.querySelector(".doc-sheet__entry-row") as HTMLElement);
    const dialog = screen.getByRole("dialog", { name: "Edit · Experience" });
    fireEvent.input(within(dialog).getByRole("textbox", { name: "Company" }), {
      target: { value: "Lumen Health Group" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await settleDebounce();

    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(within(experienceSection()).getByText("Lumen Health")).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
    expect(within(experienceSection()).getByText("Lumen Health Group")).toBeInTheDocument();
  });

  it("autosaves a sheet edit through the store's save timer", async () => {
    await renderSheet();
    const { saveResume } = await import("../../wasm");
    vi.mocked(saveResume).mockClear();

    editCompany("Lumen Health", "Lumen Health Group");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    expect(saveResume).toHaveBeenCalledWith(
      resumeId.value,
      expect.objectContaining({
        sections: expect.objectContaining({
          experience: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ company: "Lumen Health Group" }),
            ]),
          }),
        }),
      }),
    );
  });

  it("pushes an undo snapshot and schedules a save on version revert", async () => {
    await renderSheet();
    const { resumeStore } = await import("../../stores/resume");
    const { saveResume } = await import("../../wasm");
    vi.mocked(saveResume).mockClear();

    const snapshot = loadDocEditorFixture();
    snapshot.sections.experience.items[0].company = "Reverted Corp";
    resumeStore.revertToSnapshot(snapshot);

    expect(within(experienceSection()).getByText("Reverted Corp")).toBeInTheDocument();

    // The revert is undoable: the pre-revert resume was pushed as a snapshot.
    expect(undoButton()).not.toBeDisabled();
    fireEvent.click(undoButton());
    expect(within(experienceSection()).getByText("Lumen Health")).toBeInTheDocument();

    // And the revert itself was persisted before the undo rewrote it.
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saveResume).toHaveBeenCalled();
  });

  it("opens the version-history dialog from the toolbar", async () => {
    await renderSheet();
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "History" }));

    // Lazy chunk + list load (IndexedDB is unavailable in jsdom, so the
    // local-mode list resolves empty).
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Version History" })).toBeInTheDocument(),
    );
    expect(screen.getByText(/No saved versions yet/)).toBeInTheDocument();
  });
});
