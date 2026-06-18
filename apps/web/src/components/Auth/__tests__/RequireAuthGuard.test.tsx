import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { RequireAuthGuard } from "../RequireAuthGuard";

const { mockAuthState, navigateMock, useLocationMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: true,
    user: null as { id: string; plan: string } | null,
  },
  navigateMock: vi.fn(),
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
  },
}));

vi.mock("@solidjs/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solidjs/router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
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
  it("redirects signed-out users to login when require-auth mode is active", () => {
    navigateMock.mockClear();
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard();

    expect(navigateMock).toHaveBeenCalledWith("/auth/login", { replace: true });
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("shows protected content when the user is signed in", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = { id: "user-1", plan: "free" };
    navigateMock.mockClear();

    renderGuard();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("does not redirect when require-auth mode is disabled", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;
    navigateMock.mockClear();

    renderGuard();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not redirect in self-hosted mode", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;
    navigateMock.mockClear();

    renderGuard();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not redirect when the user is signed in", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = { id: "user-1", plan: "free" };
    navigateMock.mockClear();

    renderGuard();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("defers navigation while auth is loading", () => {
    mockAuthState.loading = true;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;
    navigateMock.mockClear();

    renderGuard();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("does not redirect on auth callback paths", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;
    navigateMock.mockClear();

    renderGuard("/auth/callback");

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not redirect on account sub-routes", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;
    navigateMock.mockClear();

    renderGuard("/account/settings");

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
