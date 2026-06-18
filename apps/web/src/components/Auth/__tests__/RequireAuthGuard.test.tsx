import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { RequireAuthGuard } from "../RequireAuthGuard";

const { mockAuthState, navigateMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: true,
    user: null as { id: string; plan: string } | null,
  },
  navigateMock: vi.fn(),
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
    useLocation: () => ({
      pathname: "/edit/resume-1",
      search: "",
      hash: "",
      state: null,
      query: {},
    }),
  };
});

function renderGuard() {
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
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderGuard();

    expect(navigateMock).toHaveBeenCalledWith("/auth/login", { replace: true });
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
});
