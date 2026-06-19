import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import NotFound from "../NotFound";

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

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
    useNavigate: () => navigateMock,
  };
});

describe("NotFound page", () => {
  it("renders a helpful 404 message with navigation actions", () => {
    navigateMock.mockClear();

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

  it("navigates home when the primary action is clicked", () => {
    navigateMock.mockClear();

    render(() => (
      <Router>
        <Route path="*" component={NotFound} />
      </Router>
    ));

    fireEvent.click(screen.getByRole("button", { name: "Back to resumes" }));
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });
});
