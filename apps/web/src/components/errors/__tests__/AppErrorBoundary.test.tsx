import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { AppErrorBoundary } from "../AppErrorBoundary";

function ThrowingChild(): null {
  throw new Error("Test render error");
}

describe("AppErrorBoundary", () => {
  it("renders the fallback UI when a child throws during render", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(() => (
      <Router>
        <Route
          path="*"
          component={() => (
            <AppErrorBoundary>
              <ThrowingChild />
            </AppErrorBoundary>
          )}
        />
      </Router>
    ));

    expect(screen.getByTestId("app-error-boundary")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText(/Test render error/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("recovers when Try again is clicked after a transient error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;

    function MaybeThrowingChild() {
      if (shouldThrow) {
        throw new Error("Transient render error");
      }
      return <div data-testid="recovered-content">Recovered</div>;
    }

    render(() => (
      <Router>
        <Route
          path="*"
          component={() => (
            <AppErrorBoundary>
              <MaybeThrowingChild />
            </AppErrorBoundary>
          )}
        />
      </Router>
    ));

    expect(screen.getByTestId("app-error-boundary")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByTestId("recovered-content")).toBeInTheDocument();
    expect(screen.queryByTestId("app-error-boundary")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});
