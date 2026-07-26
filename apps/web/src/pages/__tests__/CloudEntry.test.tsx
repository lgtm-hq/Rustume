import { Route, Router } from "@solidjs/router";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import CloudEntry from "../CloudEntry";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("../../stores/auth", () => ({
  authStore: {
    get state() {
      return { cloudEnabled: true, requireAuth: true, user: null, loading: false };
    },
    signIn: signInMock,
  },
}));

function renderPage() {
  return render(() => (
    <Router>
      <Route path="*" component={CloudEntry} />
    </Router>
  ));
}

describe("CloudEntry page", () => {
  it("presents both paths, not just sign-in", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /typeset properly/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rustume Cloud", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Run it yourself", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Install the desktop build/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Self-host the server/ })).toBeInTheDocument();
  });

  it("is a landing page, not an error page", () => {
    renderPage();

    // The 401 framing was removed deliberately: arriving here is not an error.
    expect(screen.queryByText("401")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign in required/i)).not.toBeInTheDocument();
  });

  it("starts sign-in when the primary action is clicked", () => {
    signInMock.mockClear();
    renderPage();

    fireEvent.click(screen.getByTestId("cloud-entry-signin"));

    expect(signInMock).toHaveBeenCalledTimes(1);
  });

  it("does not claim there are no accounts", () => {
    renderPage();

    // Regression guard on the pre-#569 copy: "No accounts, no tracking" is false
    // on a deployment whose only purpose is creating an account.
    expect(screen.getByText(/Local-first by design/)).toBeInTheDocument();
    expect(screen.queryByText(/no accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stays on your device/i)).not.toBeInTheDocument();
  });

  it("keeps the restored reason cards", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Why Rustume?", level: 2 })).toBeInTheDocument();
    for (const title of ["Privacy First", "Works Offline", "Lightning Fast"]) {
      expect(screen.getByRole("heading", { name: title, level: 3 })).toBeInTheDocument();
    }
  });
});

describe("CloudEntry accessibility", () => {
  it("has no axe violations when rendered", async () => {
    const { container } = renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has exactly one level-1 heading", () => {
    renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
