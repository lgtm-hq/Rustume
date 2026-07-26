import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { AuthMenu } from "../AuthMenu";

const { mockAuthState, signInMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
    user: null as { id: string; email?: string; plan: string } | null,
    signInDialogOpen: false,
  },
  signInMock: vi.fn(),
}));

vi.mock("../../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: signInMock,
    signOut: vi.fn(),
    displayName: () => "Test User",
  },
}));

describe("AuthMenu", () => {
  it("shows a compact header sign-in without policy consent", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    render(() => (
      <Router>
        <Route path="/" component={AuthMenu} />
      </Router>
    ));

    expect(screen.getByTestId("header-sign-in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to sync" })).toBeInTheDocument();
    expect(screen.queryByTestId("policy-consent")).not.toBeInTheDocument();
  });

  it("requests sign-in (opens confirm dialog) when the header button is clicked", () => {
    mockAuthState.user = null;
    signInMock.mockClear();

    render(() => (
      <Router>
        <Route path="/" component={AuthMenu} />
      </Router>
    ));

    fireEvent.click(screen.getByTestId("header-sign-in"));
    expect(signInMock).toHaveBeenCalledTimes(1);
  });
});
