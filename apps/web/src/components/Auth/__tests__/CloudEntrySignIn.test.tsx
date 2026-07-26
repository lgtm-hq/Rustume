import { Route, Router } from "@solidjs/router";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../App";
import { authStore } from "../../../stores/auth";

/*
 * Regression test for #589.
 *
 * The bug was invisible to a page-level test: RequireAuthGuard renders the entry
 * page INSTEAD of its children, so AppShell — which used to host SignInDialog —
 * never mounted. Clicking sign-in set store state nothing was subscribed to.
 *
 * So this renders the REAL App with the REAL auth store. Reproducing the
 * guard/dialog composition by hand here would be vacuous — it would still pass
 * if App.tsx stopped mounting the dialog, which is precisely the bug.
 */

const probeAuthMock = vi.fn();

vi.mock("../../../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/auth")>();
  return {
    ...actual,
    probeAuth: () => probeAuthMock(),
    login: vi.fn(),
  };
});

vi.mock("../../../wasm", () => ({
  initWasm: () => Promise.resolve(),
}));

vi.mock("@solidjs/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solidjs/router")>();
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/edit/resume-1",
      search: "",
      hash: "",
      state: null,
      query: {},
    }),
  };
});

function renderAppComposition() {
  return render(() => (
    <Router>
      <Route
        path="*"
        component={() => (
          <App>
            <div data-testid="protected-content">Protected</div>
          </App>
        )}
      />
    </Router>
  ));
}

describe("Cloud entry sign-in (#589)", () => {
  beforeEach(async () => {
    probeAuthMock.mockReset();
    probeAuthMock.mockResolvedValue({ mode: "cloud", requireAuth: true, user: null });
    // refresh() does not clear dialog state; without this a test failing between
    // the click and its assertion bleeds an open modal into the next test.
    authStore.closeSignInDialog();
    await authStore.refresh();
  });

  it("opens the sign-in dialog from the entry page", async () => {
    renderAppComposition();

    await waitFor(() => expect(screen.getByTestId("cloud-entry-page")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cloud-entry-signin"));

    // The assertion that would have failed before the fix: state flipped, but no
    // dialog existed in the tree to render it.
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    authStore.closeSignInDialog();
  });

  it("blocks cloud deployments even when require-auth is off", async () => {
    probeAuthMock.mockResolvedValue({ mode: "cloud", requireAuth: false, user: null });
    await authStore.refresh();

    renderAppComposition();

    // Anonymous cloud use is not supported, so requireAuth must not weaken the gate.
    await waitFor(() => expect(screen.getByTestId("cloud-entry-page")).toBeInTheDocument());
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("never blocks self-hosted deployments", async () => {
    probeAuthMock.mockResolvedValue({ mode: "self-hosted" });
    await authStore.refresh();

    renderAppComposition();

    await waitFor(() => expect(screen.getByTestId("protected-content")).toBeInTheDocument());
    expect(screen.queryByTestId("cloud-entry-page")).not.toBeInTheDocument();
  });
});
