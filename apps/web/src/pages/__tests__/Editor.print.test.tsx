import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { Route, MemoryRouter, createMemoryHistory } from "@solidjs/router";
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
  renderPreview: vi.fn().mockResolvedValue({ url: "blob:preview", totalPages: 1 }),
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

describe("Editor print shortcut", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("Cmd/Ctrl+P opens the browser print dialog", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderEditor();

    await waitFor(
      () => {
        expect(screen.getByText("Full Name")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "p", ctrlKey: true, bubbles: true }),
    );

    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  }, 15000);
});
