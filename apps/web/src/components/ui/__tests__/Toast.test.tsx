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
    render(() => <ToastRegion />);

    await waitFor(() => {
      expect(document.querySelector("ol")).toBeTruthy();
    });

    expect(document.querySelector("ol")).toHaveAttribute("role", "none");
  });

  it("keeps the labelled notification region that carries the announcements", async () => {
    render(() => <ToastRegion />);

    await waitFor(() => {
      expect(document.querySelector('[role="region"]')).toBeTruthy();
    });
  });
});
