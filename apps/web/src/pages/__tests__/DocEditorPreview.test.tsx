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

/** Real-time wait that outlasts the preview's 500 ms resume debounce. */
function settleDebounce() {
  return new Promise((resolve) => setTimeout(resolve, 750));
}

async function renderEditorWithPreview() {
  const result = renderAt(DocEditor);
  await waitFor(() => expect(screen.getByTestId("doc-editor-preview-pane")).toBeInTheDocument());
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
  });

  it("mounts the live preview with exactly one render fetch", async () => {
    await renderEditorWithPreview();

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Resume preview" })).toBeInTheDocument(),
    );
    // Let the resume-debounce window close: the second fetch effect must
    // recognise the mount render as already requested and stay quiet.
    await settleDebounce();

    expect(renderPreview).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("doc-editor-preview-placeholder")).toBeNull();
  });

  it("syncs the page-count pill with the rendered page count", async () => {
    await renderEditorWithPreview();

    // The sheet's own pagination says 2 pages; the server render says 3. The
    // pill must report the ground truth.
    await waitFor(() =>
      expect(screen.getByTestId("doc-editor-page-count")).toHaveTextContent("3 pages"),
    );
  });

  it("refreshes the preview once, debounced, after a burst of store mutations", async () => {
    await renderEditorWithPreview();
    await waitFor(() => expect(renderPreview).toHaveBeenCalledTimes(1));
    await settleDebounce();

    resumeStore.updateBasics("name", "Mireille Okafor-Reyes");
    resumeStore.updateBasics("headline", "Staff Design Systems Engineer");
    await settleDebounce();

    expect(renderPreview).toHaveBeenCalledTimes(2);
    const [resume] = vi.mocked(renderPreview).mock.calls[1];
    expect(resume.basics.name).toBe("Mireille Okafor-Reyes");
    expect(resume.basics.headline).toBe("Staff Design Systems Engineer");
  });

  it("surfaces a render failure through the error toast", async () => {
    vi.mocked(renderPreview).mockRejectedValue(new Error("typst blew up"));

    await renderEditorWithPreview();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Preview rendering failed"));
    // The pill falls back to the sheet's own pagination when no render lands.
    expect(screen.getByTestId("doc-editor-page-count")).not.toHaveTextContent("3 pages");
  });
});
