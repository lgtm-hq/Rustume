import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import type { ResumeListItem } from "../../stores/persistence";
import Home from "../Home";

const { mockAuthState, signInMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: false,
    requireAuth: false,
    user: null as { id: string; plan: string } | null,
  },
  signInMock: vi.fn(),
}));

const mockResumes = vi.hoisted(() => {
  const resumes: ResumeListItem[] = [
    {
      id: "1",
      name: "Software Engineer",
      updatedAt: new Date("2025-01-01"),
      headline: "Staff Platform Engineer",
    },
    { id: "2", name: "Product Manager", updatedAt: new Date("2025-02-01") },
    {
      id: "3",
      name: "Jane Doe — Designer",
      updatedAt: new Date("2025-03-01"),
      headline: "   ",
    },
  ];
  return resumes;
});

const resumeListMock = vi.hoisted(() => ({
  resumes: () => mockResumes,
  loading: () => false,
  deleteResume: vi.fn(),
  duplicateResume: vi.fn(),
  renameResume: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: signInMock,
  },
}));

vi.mock("../../stores/persistence", () => ({
  useResumeList: () => resumeListMock,
}));

vi.mock("../../wasm/types", () => ({
  generateId: () => "resume-test-id",
}));

function renderHome() {
  return render(() => (
    <Router>
      <Route path="/" component={Home} />
    </Router>
  ));
}

const openModalMock = vi.hoisted(() => vi.fn());

vi.mock("../../stores/ui", () => ({
  uiStore: {
    store: { modal: null },
    openModal: openModalMock,
    closeModal: vi.fn(),
  },
}));

describe("Home resume search", () => {
  beforeEach(() => {
    sessionStorage.clear();
    openModalMock.mockClear();
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;
  });

  it("offers create and import actions on the hero", () => {
    renderHome();

    expect(screen.getByTestId("home-create-resume")).toBeInTheDocument();
    expect(screen.getByTestId("home-import-resume")).toBeInTheDocument();
  });

  it("opens the import modal from the hero import button", () => {
    renderHome();

    fireEvent.click(screen.getByTestId("home-import-resume"));
    expect(openModalMock).toHaveBeenCalledWith("import");
  });

  it("shows a labeled search input when resumes exist", () => {
    renderHome();

    expect(screen.getByTestId("resume-search-input")).toBeInTheDocument();
    expect(screen.getByLabelText("Search resumes")).toBeInTheDocument();
  });

  it("shows headline as secondary text under the resume title", () => {
    renderHome();

    expect(screen.getByTestId("resume-list-headline")).toHaveTextContent(
      "Staff Platform Engineer",
    );
  });

  it("omits headline when it is missing or whitespace-only", () => {
    renderHome();

    // Only the first resume has a non-empty headline.
    expect(screen.getAllByTestId("resume-list-headline")).toHaveLength(1);
  });

  it("filters resumes as the user types", () => {
    renderHome();

    fireEvent.input(screen.getByTestId("resume-search-input"), {
      target: { value: "product" },
    });

    expect(screen.getByRole("heading", { name: /Product Manager/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Software Engineer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Jane Doe/i })).not.toBeInTheDocument();
  });

  it("shows an empty state when no resumes match", () => {
    renderHome();

    fireEvent.input(screen.getByTestId("resume-search-input"), {
      target: { value: "zzzznotfound" },
    });

    expect(screen.getByTestId("resume-search-empty")).toBeInTheDocument();
    expect(screen.getByText(/No matching resumes/i)).toBeInTheDocument();
  });

  it("persists the search query in sessionStorage", () => {
    renderHome();

    fireEvent.input(screen.getByTestId("resume-search-input"), {
      target: { value: "jane" },
    });

    expect(sessionStorage.getItem("rustume:home-resume-search")).toBe("jane");
  });
});

describe("Home cloud local banner", () => {
  it("shows the local-mode banner when cloud is enabled and the user is signed out", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    renderHome();

    expect(screen.getByTestId("home-cloud-local-banner")).toBeInTheDocument();
    expect(screen.getByText(/Working locally on this device/i)).toBeInTheDocument();
    // Primary CTA lives in the header (AuthMenu), not a second banner button.
    expect(screen.queryByTestId("home-cloud-sign-in")).not.toBeInTheDocument();
  });

  it("hides the cloud banner when hosted require-auth mode is active", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderHome();

    expect(screen.queryByTestId("home-cloud-local-banner")).not.toBeInTheDocument();
  });

  it("hides the cloud banner when the user is signed in", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "user-1", plan: "free" };

    renderHome();

    expect(screen.queryByTestId("home-cloud-local-banner")).not.toBeInTheDocument();
  });

  it("hides the cloud banner in self-hosted mode", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.user = null;

    renderHome();

    expect(screen.queryByTestId("home-cloud-local-banner")).not.toBeInTheDocument();
  });
});

describe("Home accessibility", () => {
  it("has no axe violations when rendered", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.user = null;

    const { container } = renderHome();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
