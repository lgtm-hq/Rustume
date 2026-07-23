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
    { id: "1", name: "Software Engineer", updatedAt: new Date("2025-01-01") },
    { id: "2", name: "Product Manager", updatedAt: new Date("2025-02-01") },
    { id: "3", name: "Jane Doe — Designer", updatedAt: new Date("2025-03-01") },
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

describe("Home resume search", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;
  });

  it("shows a labeled search input when resumes exist", () => {
    renderHome();

    expect(screen.getByTestId("resume-search-input")).toBeInTheDocument();
    expect(screen.getByLabelText("Search resumes")).toBeInTheDocument();
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

describe("Home cloud sign-in CTA", () => {
  it("shows the cloud banner when cloud is enabled and the user is signed out", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    renderHome();

    expect(screen.getByTestId("home-cloud-sign-in")).toBeInTheDocument();
    expect(screen.getByText(/Working locally on this device/i)).toBeInTheDocument();
  });

  it("hides the cloud banner when hosted require-auth mode is active", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderHome();

    expect(screen.queryByTestId("home-cloud-sign-in")).not.toBeInTheDocument();
  });

  it("hides the cloud banner when the user is signed in", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "user-1", plan: "free" };

    renderHome();

    expect(screen.queryByTestId("home-cloud-sign-in")).not.toBeInTheDocument();
  });

  it("hides the cloud banner in self-hosted mode", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.user = null;

    renderHome();

    expect(screen.queryByTestId("home-cloud-sign-in")).not.toBeInTheDocument();
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
