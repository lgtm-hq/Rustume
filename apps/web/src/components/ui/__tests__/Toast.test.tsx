import { describe, expect, it } from "vitest";
import { render, waitFor } from "@solidjs/testing-library";
import { ToastRegion } from "../Toast";

/**
 * Kobalte renders the stack as an `<ol>` whose children are `<li role="status">`.
 * A status is not a listitem, so leaving the implicit list role in place makes
 * the markup fail axe's `list` rule for as long as any toast is on screen.
 */
describe("ToastRegion list semantics", () => {
  it("does not expose the toast stack as a list", async () => {
    // Scoped to this render's container: querying the whole document would let
    // a region left behind by another test satisfy the assertion.
    const { container } = render(() => <ToastRegion />);

    await waitFor(() => {
      expect(container.querySelector("ol")).toBeTruthy();
    });

    expect(container.querySelector("ol")).toHaveAttribute("role", "none");
  });

  it("keeps the labelled notification region that carries the announcements", async () => {
    const { container } = render(() => <ToastRegion />);

    await waitFor(() => {
      expect(container.querySelector('[role="region"]')).toBeTruthy();
    });
  });
});
