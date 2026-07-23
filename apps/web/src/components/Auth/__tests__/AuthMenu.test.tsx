import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { AuthMenu } from "../AuthMenu";

const { mockAuthState, signInMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
    user: null as { id: string; email?: string; plan: string } | null,
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

describe("AuthMenu policy consent", () => {
  it("shows consent links at the sign-in entry point", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    render(() => (
      <Router>
        <Route path="/" component={AuthMenu} />
      </Router>
    ));

    expect(screen.getByTestId("policy-consent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
