import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../../test/a11y";
import { Modal } from "../Modal";

function ModalHarness() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      <Modal open={open()} onOpenChange={setOpen} title="Confirm action">
        <p>Modal body content</p>
      </Modal>
    </>
  );
}

describe("Modal accessibility", () => {
  it("has no axe violations when open", async () => {
    const onOpenChange = vi.fn();
    const { container } = render(() => (
      <Modal
        open
        title="Confirm action"
        description="Review the details before continuing."
        onOpenChange={onOpenChange}
      >
        <p>Modal body content</p>
      </Modal>
    ));

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });

  it("restores focus to the trigger when closed with Escape", async () => {
    render(() => <ModalHarness />);

    const trigger = screen.getByRole("button", { name: "Open modal" });
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });
});
