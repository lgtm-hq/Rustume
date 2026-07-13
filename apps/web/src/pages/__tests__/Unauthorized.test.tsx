import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import Unauthorized from "../Unauthorized";

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
}));

vi.mock("../../stores/auth", () => ({
  authStore: {
    signIn: signInMock,
  },
}));

describe("Unauthorized page", () => {
  it("renders sign-in guidance and actions", () => {
    signInMock.mockClear();

    render(() => (
      <Router>
        <Route path="*" component={Unauthorized} />
      </Router>
    ));

    expect(screen.getByTestId("unauthorized-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in to sync across devices" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn about cloud accounts" })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("starts sign-in when the primary action is clicked", () => {
    signInMock.mockClear();

    render(() => (
      <Router>
        <Route path="*" component={Unauthorized} />
      </Router>
    ));

    fireEvent.click(screen.getByRole("button", { name: "Sign in to sync across devices" }));
    expect(signInMock).toHaveBeenCalledTimes(1);
  });
});

describe("Unauthorized accessibility", () => {
  it("has no axe violations when rendered", async () => {
    const { container } = render(() => (
      <Router>
        <Route path="*" component={Unauthorized} />
      </Router>
    ));

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
