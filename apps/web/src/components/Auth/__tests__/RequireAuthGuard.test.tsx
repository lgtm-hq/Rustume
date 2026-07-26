import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { RequireAuthGuard } from "../RequireAuthGuard";

const { mockAuthState, useLocationMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: true,
    user: null as { id: string; plan: string } | null,
  },
  useLocationMock: vi.fn(() => ({
    pathname: "/edit/resume-1",
    search: "",
    hash: "",
    state: null,
    query: {},
  })),
}));

vi.mock("../../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: vi.fn(),
  },
}));

vi.mock("@solidjs/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solidjs/router")>();
  return {
    ...actual,
    useLocation: () => useLocationMock(),
  };
});

function renderGuard(pathname = "/edit/resume-1") {
  useLocationMock.mockReturnValue({
    pathname,
    search: "",
    hash: "",
    state: null,
    query: {},
  });

  return render(() => (
    <Router>
      <Route
        path="*"
        component={() => (
          <RequireAuthGuard>
            <div data-testid="protected-content">Protected</div>
          </RequireAuthGuard>
        )}
      />
    </Router>
  ));
}

describe("RequireAuthGuard", () => {
  it("shows the Cloud entry page when a hosted deployment has no user", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard();

    expect(screen.getByTestId("cloud-entry-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("shows protected content when the user is signed in", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = { id: "user-1", plan: "free" };

    renderGuard();

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.queryByTestId("cloud-entry-page")).not.toBeInTheDocument();
  });

  // Previously this asserted the opposite. Anonymous use of Rustume Cloud is not
  // supported, so requireAuth must never weaken the gate (#589).
  it("blocks cloud deployments even when require-auth mode is disabled", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    renderGuard();

    expect(screen.getByTestId("cloud-entry-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("does not block in self-hosted mode", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    renderGuard();

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("shows a loading state while auth is loading", () => {
    mockAuthState.loading = true;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard();

    expect(screen.getByLabelText("Loading authentication")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cloud-entry-page")).not.toBeInTheDocument();
  });

  it("does not block auth callback paths", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard("/auth/callback");

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("does not block account sub-routes", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard("/account/settings");

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("does not block the terms page", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard("/terms");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("does not block the privacy page", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard("/privacy");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("does not block the terms page with a trailing slash", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard("/terms/");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("does not block the privacy page with a trailing slash", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard("/privacy/");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });
});
