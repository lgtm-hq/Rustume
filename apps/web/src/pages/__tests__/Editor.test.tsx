import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { Route, MemoryRouter, createMemoryHistory } from "@solidjs/router";
import { axeConfig } from "../../test/a11y";
import Editor from "../Editor";

const { mockAuthState, navigateMock, ResumeNotFoundErrorMock, RESUME_ID } = vi.hoisted(() => {
  class ResumeNotFoundError extends Error {
    constructor(id: string) {
      super(`Resume not found: ${id}`);
      this.name = "ResumeNotFoundError";
    }
  }

  return {
    mockAuthState: {
      loading: false,
      cloudEnabled: false,
      requireAuth: false,
      user: null as { id: string; plan: string } | null,
    },
    navigateMock: vi.fn(),
    ResumeNotFoundErrorMock: ResumeNotFoundError,
    RESUME_ID: "resume-test-id",
  };
});

vi.mock("../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    displayName: () => "User",
  },
}));

vi.mock("../../wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../wasm")>();
  return {
    ...actual,
    getResume: vi.fn().mockRejectedValue(new ResumeNotFoundErrorMock(RESUME_ID)),
    isWasmReady: () => false,
    ensureWasmReady: async () => false,
    saveResume: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../api/render", () => ({
  renderPreview: vi.fn().mockResolvedValue(new Blob()),
  downloadPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../components/preview", () => ({
  Preview: () => <div data-testid="preview-stub">Preview</div>,
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

vi.mock("@solidjs/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solidjs/router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderEditor() {
  const history = createMemoryHistory();
  history.set({ value: `/edit/${RESUME_ID}`, scroll: false, replace: true });

  return render(() => (
    <MemoryRouter history={history}>
      <Route path="/edit/:id" component={Editor} />
    </MemoryRouter>
  ));
}

describe("Editor accessibility", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("has no axe violations when the basics tab is loaded", async () => {
    const { container } = renderEditor();

    await waitFor(
      () => {
        expect(screen.getByText("Full Name")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  }, 15000);
});

describe("Editor section navigation", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("switches sections without remounting the preview shell", async () => {
    renderEditor();

    await waitFor(
      () => {
        expect(screen.getByText("Full Name")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const previewBefore = screen.getByTestId("editor-preview-pane");
    const leftBefore = screen.getByTestId("editor-left-pane");

    fireEvent.click(screen.getByRole("button", { name: "Experience" }));

    await waitFor(() => {
      expect(screen.queryByText("Full Name")).not.toBeInTheDocument();
      expect(screen.getByText("Tech Company")).toBeInTheDocument();
    });

    expect(screen.getByTestId("editor-preview-pane")).toBe(previewBefore);
    expect(screen.getByTestId("editor-left-pane")).toBe(leftBefore);
  }, 15000);
});
