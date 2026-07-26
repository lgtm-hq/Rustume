import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { axeConfig } from "../../test/a11y";
import Terms from "../Terms";
import { TERMS_VERSION } from "../../lib/policies";

describe("Terms page", () => {
  it("renders version and effective date", () => {
    render(() => (
      <Router>
        <Route path="/" component={Terms} />
      </Router>
    ));

    expect(screen.getByTestId("terms-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Version ${TERMS_VERSION}`))).toBeInTheDocument();
    expect(screen.getByText(/Effective/)).toBeInTheDocument();
    expect(screen.getByText(/DRAFT — pending legal review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});

describe("Terms accessibility", () => {
  it("has no axe violations when rendered", async () => {
    const { container } = render(() => (
      <Router>
        <Route path="/" component={Terms} />
      </Router>
    ));

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
