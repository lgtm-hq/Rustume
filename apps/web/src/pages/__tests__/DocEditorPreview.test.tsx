/**
 * The doc editor's right pane: the live server-rendered preview (#732).
 *
 * Unlike `DocEditor.test.tsx`, these tests mount the real `Preview` component
 * (API mocked) to pin the integration contract: one render per paint — no
 * double fetch on mount, one debounced refresh per burst of store mutations —
 * the pill synced to the rendered page count, and failures surfaced through
 * the toast.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { Suspense, type Component } from "solid-js";
import { loadDocEditorFixture, SIDEBAR_TEMPLATE } from "../../test/docEditorFixture";
import { renderPreview } from "../../api/render";
import { toast } from "../../components/ui";
import { resumeStore } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import DocEditor from "../DocEditor";

const { fixture, resumeId } = vi.hoisted(() => ({
  fixture: { value: null as unknown },
  // `resumeStore` is a module singleton and `useResumeRouteLoad` skips the load
  // when the route id already matches what it holds. A fresh id per test forces
  // the reload, so a test that writes through the store cannot leak into the
  // next one's fixture.
  resumeId: { value: "doc-editor-preview-fixture-0" },
}));

vi.mock("../../lib/flags", () => ({
  isDocEditorEnabled: () => true,
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
  renderPreview: vi.fn(),
  downloadPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../components/ui")>();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

// The print-stack prefetch debounces off the preview URL and, on a slow CI
// runner, its window elapses mid-test and injects extra renderPreview calls —
// breaking the exact call counts these tests pin. It has its own unit tests
// (printStack.test.ts), so stub it to keep the counts deterministic.
vi.mock("../../components/preview/printStack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../components/preview/printStack")>();
  return {
    ...actual,
    prefetchPrintStackPages: vi.fn().mockResolvedValue({ urls: [], hasHardFailure: false }),
  };
});

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

/**
 * Real-time wait that outlasts the preview's 500 ms resume debounce with a
 * wide margin for CI load. Needed because several assertions here are
 * negative ("no further fetch happened"), which `waitFor` cannot express.
 */
function settleDebounce() {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

/**
 * `waitFor` with a generous window: the shared coverage runner starves the
 * event loop well past the 1 s default when test files run in parallel.
 */
function waitLong<T>(callback: () => T) {
  return waitFor(callback, { timeout: 10_000 });
}

async function renderEditorWithPreview() {
  const result = renderAt(DocEditor);
  await waitLong(() => expect(screen.getByTestId("doc-editor-preview-pane")).toBeInTheDocument());
  return result;
}

describe("DocEditor preview pane", () => {
  let renderCount = 0;

  beforeEach(() => {
    fixture.value = loadDocEditorFixture();
    resumeId.value = `doc-editor-preview-fixture-${++renderCount}`;
    vi.mocked(renderPreview).mockReset();
    vi.mocked(renderPreview).mockResolvedValue({ url: "blob:preview-1", totalPages: 3 });
    vi.mocked(toast.error).mockClear();
    // `uiStore` is a module singleton; a page-flipping test must not leak its
    // page index into the next test's mount fetch.
    uiStore.setPreviewPage(0);
  });

  it("mounts the live preview with exactly one render fetch", async () => {
    await renderEditorWithPreview();

    await waitLong(() =>
      expect(screen.getByRole("img", { name: "Resume preview" })).toBeInTheDocument(),
    );
    // Let the resume-debounce window close: the second fetch effect must
    // recognise the mount render as already requested and stay quiet.
    await settleDebounce();

    expect(renderPreview).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("doc-editor-preview-placeholder")).toBeNull();
  }, 20_000);

  it("syncs the page-count pill with the rendered page count", async () => {
    await renderEditorWithPreview();

    // The sheet's own pagination says 2 pages; the server render says 3. The
    // pill must report the ground truth.
    await waitLong(() =>
      expect(screen.getByTestId("doc-editor-page-count")).toHaveTextContent("3 pages"),
    );
  }, 20_000);

  it("refreshes the preview once, debounced, after a burst of store mutations", async () => {
    await renderEditorWithPreview();
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(1));
    await settleDebounce();

    resumeStore.updateBasics("name", "Mireille Okafor-Reyes");
    resumeStore.updateBasics("headline", "Staff Design Systems Engineer");
    await settleDebounce();

    expect(renderPreview).toHaveBeenCalledTimes(2);
    const [resume] = vi.mocked(renderPreview).mock.calls[1];
    expect(resume.basics.name).toBe("Mireille Okafor-Reyes");
    expect(resume.basics.headline).toBe("Staff Design Systems Engineer");
  }, 20_000);

  it("ignores a stale resume render that resolves after a newer page render", async () => {
    const pending: Array<(result: { url: string; totalPages: number }) => void> = [];
    vi.mocked(renderPreview).mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );

    await renderEditorWithPreview();
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(1));
    pending[0]({ url: "blob:initial", totalPages: 3 });
    await waitLong(() =>
      expect(screen.getByRole("img", { name: "Resume preview" })).toHaveAttribute(
        "src",
        "blob:initial",
      ),
    );

    // A debounced resume render goes out and hangs...
    resumeStore.updateBasics("name", "Mireille Okafor-Reyes");
    await settleDebounce();
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(2));

    // ...the user flips the page meanwhile, and that newer render lands first.
    uiStore.setPreviewPage(1);
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(3));
    pending[2]({ url: "blob:page-1", totalPages: 3 });
    await waitLong(() =>
      expect(screen.getByRole("img", { name: "Resume preview" })).toHaveAttribute(
        "src",
        "blob:page-1",
      ),
    );

    // The stale resume response must not clobber the newer page render.
    pending[1]({ url: "blob:stale", totalPages: 3 });
    await settleDebounce();
    expect(screen.getByRole("img", { name: "Resume preview" })).toHaveAttribute(
      "src",
      "blob:page-1",
    );
  }, 20_000);

  it("clamps the page index when a page-driven render reports fewer pages", async () => {
    const pending: Array<(result: { url: string; totalPages: number }) => void> = [];
    vi.mocked(renderPreview).mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );

    await renderEditorWithPreview();
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(1));
    pending[0]({ url: "blob:initial", totalPages: 3 });
    await waitLong(() =>
      expect(screen.getByRole("img", { name: "Resume preview" })).toHaveAttribute(
        "src",
        "blob:initial",
      ),
    );

    // Flip to the last page; the server now says the content shrank to 2
    // pages, so the page-driven fetch must clamp the index back in range.
    uiStore.setPreviewPage(2);
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(2));
    pending[1]({ url: "blob:page-3", totalPages: 2 });

    await waitLong(() => expect(uiStore.store.previewPage).toBe(1));
  }, 20_000);

  it("keeps refreshes debounced after a page flip, under production mock physics", async () => {
    // The real renderPreview stringifies its resume argument synchronously
    // (cloneResumeForApi). A mock that never touches the proxy cannot form
    // the deep subscription that once let the page effect bypass the
    // debounce, so this mock reproduces that read.
    vi.mocked(renderPreview).mockImplementation((resume) => {
      JSON.stringify(resume);
      return Promise.resolve({ url: "blob:preview-1", totalPages: 3 });
    });

    await renderEditorWithPreview();
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(1));
    await settleDebounce();

    // A page flip runs the page-driven fetch...
    uiStore.setPreviewPage(1);
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(2));

    // ...after which store mutations must still refresh once, debounced —
    // not immediately per keystroke via a page-effect deep subscription.
    resumeStore.updateBasics("name", "Mireille Okafor-Reyes");
    resumeStore.updateBasics("headline", "Staff Design Systems Engineer");
    expect(renderPreview).toHaveBeenCalledTimes(2);
    await settleDebounce();
    await waitLong(() => expect(renderPreview).toHaveBeenCalledTimes(3));
    await settleDebounce();
    expect(renderPreview).toHaveBeenCalledTimes(3);
  }, 20_000);

  it("surfaces a render failure through the error toast", async () => {
    vi.mocked(renderPreview).mockRejectedValue(new Error("typst blew up"));

    await renderEditorWithPreview();

    await waitLong(() => expect(toast.error).toHaveBeenCalledWith("Preview rendering failed"));
    // The pill falls back to the sheet's own pagination when no render lands.
    expect(screen.getByTestId("doc-editor-page-count")).toHaveTextContent("2 pages");
  }, 20_000);
});
