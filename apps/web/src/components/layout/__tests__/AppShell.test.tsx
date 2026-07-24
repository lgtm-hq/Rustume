import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { axeConfig } from "../../../test/a11y";
import { AppShell } from "../AppShell";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: false,
    requireAuth: false,
    user: null as { id: string; plan: string } | null,
    signInDialogOpen: false,
  },
}));

vi.mock("../../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: vi.fn(),
    closeSignInDialog: vi.fn(),
    confirmSignIn: vi.fn(),
    signOut: vi.fn(),
    displayName: () => "User",
  },
}));

vi.mock("../../../hooks/useOnline", () => ({
  useOnline: () => () => true,
}));

vi.mock("@solidjs/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solidjs/router")>();
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/",
      search: "",
      hash: "",
      state: null,
      query: {},
    }),
  };
});

describe("AppShell header", () => {
  function renderShell() {
    return render(() => (
      <Router>
        <Route
          path="*"
          component={() => (
            <AppShell>
              <div>Page content</div>
            </AppShell>
          )}
        />
      </Router>
    ));
  }

  it("does not show a local-mode notice banner (Sign in to sync covers that)", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    renderShell();

    expect(screen.queryByTestId("home-cloud-local-banner")).not.toBeInTheDocument();
    expect(screen.queryByText(/Working locally/i)).not.toBeInTheDocument();
  });
});

describe("AppShell accessibility", () => {
  it("includes a skip link targeting the main landmark", () => {
    render(() => (
      <Router>
        <Route
          path="*"
          component={() => (
            <AppShell>
              <div>Page content</div>
            </AppShell>
          )}
        />
      </Router>
    ));

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(document.getElementById("main-content")).toBeTruthy();
  });

  it("has no axe violations when rendered", async () => {
    const { container } = render(() => (
      <Router>
        <Route
          path="*"
          component={() => (
            <AppShell>
              <div>Page content</div>
            </AppShell>
          )}
        />
      </Router>
    ));

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
