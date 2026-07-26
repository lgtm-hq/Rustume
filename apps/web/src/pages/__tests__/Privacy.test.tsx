import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { axeConfig } from "../../test/a11y";
import Privacy from "../Privacy";
import { PRIVACY_VERSION } from "../../lib/policies";

describe("Privacy page", () => {
  it("renders version and effective date", () => {
    render(() => (
      <Router>
        <Route path="/" component={Privacy} />
      </Router>
    ));

    expect(screen.getByTestId("privacy-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Version ${PRIVACY_VERSION}`))).toBeInTheDocument();
    expect(screen.getByText(/Effective/)).toBeInTheDocument();
    expect(screen.getByText(/DRAFT — pending legal review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });
});

describe("Privacy accessibility", () => {
  it("has no axe violations when rendered", async () => {
    const { container } = render(() => (
      <Router>
        <Route path="/" component={Privacy} />
      </Router>
    ));

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
