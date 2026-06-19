import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import NotFound from "../NotFound";

vi.mock("@solidjs/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solidjs/router")>();
  return {
    ...actual,
    useLocation: () => ({
      pathname: "/missing-page",
      search: "",
      hash: "",
      state: null,
      query: {},
    }),
    useNavigate: () => vi.fn(),
  };
});

describe("NotFound page", () => {
  it("renders a helpful 404 message with navigation actions", () => {
    render(() => (
      <Router>
        <Route path="*" component={NotFound} />
      </Router>
    ));

    expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText(/missing-page/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to resumes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open account" })).toHaveAttribute("href", "/account");
  });
});
