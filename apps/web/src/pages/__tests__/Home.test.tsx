import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import Home from "../Home";

const { mockAuthState, signInMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: false,
    user: null as { id: string; plan: string } | null,
  },
  signInMock: vi.fn(),
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
  useResumeList: () => ({
    resumes: () => [],
    loading: () => false,
    deleteResume: vi.fn(),
    duplicateResume: vi.fn(),
    renameResume: vi.fn(),
    refresh: vi.fn(),
  }),
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

describe("Home cloud sign-in CTA", () => {
  it("shows the cloud banner when cloud is enabled and the user is signed out", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = null;

    renderHome();

    expect(screen.getByTestId("home-cloud-sign-in")).toBeInTheDocument();
    expect(screen.getByText(/Working locally on this device/i)).toBeInTheDocument();
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
