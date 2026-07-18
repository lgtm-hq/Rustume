import { describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { AuthMenu } from "../AuthMenu";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    localMode: false,
    requireAuth: false,
    user: null as { id: string; plan: string } | null,
  },
}));

vi.mock("../../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    displayName: () => "Ada Lovelace",
  },
}));

function renderMenu() {
  return render(() => (
    <Router>
      <Route path="*" component={() => <AuthMenu />} />
    </Router>
  ));
}

describe("AuthMenu", () => {
  it("shows the sign-in button for signed-out cloud visitors", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.localMode = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    const { getByText, unmount } = renderMenu();
    expect(getByText("Sign in to sync")).toBeTruthy();
    unmount();
  });

  it("shows the account menu for signed-in cloud users", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.localMode = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = { id: "user-1", plan: "pro" };

    const { getByLabelText, unmount } = renderMenu();
    expect(getByLabelText("Account menu")).toBeTruthy();
    unmount();
  });

  it("hides all auth UI in local mode", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.localMode = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = {
      id: "00000000-0000-0000-0000-000000000001",
      plan: "self-hosted",
    };

    const { container, queryByText, queryByLabelText, unmount } = renderMenu();
    expect(queryByText("Sign in to sync")).toBeNull();
    expect(queryByLabelText("Account menu")).toBeNull();
    expect(container.textContent).toBe("");
    unmount();
  });
});
