import { describe, expect, it } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { PolicyConsent } from "../PolicyConsent";

describe("PolicyConsent", () => {
  it("shows the consent line with policy links", () => {
    render(() => (
      <Router>
        <Route path="/" component={() => <PolicyConsent />} />
      </Router>
    ));

    expect(screen.getByTestId("policy-consent")).toBeInTheDocument();
    expect(screen.getByText(/By continuing, you agree to the/)).toBeInTheDocument();
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
