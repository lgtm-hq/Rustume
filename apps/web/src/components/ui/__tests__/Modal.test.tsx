import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../../test/a11y";
import { Modal } from "../Modal";

function ModalHarness(props: { dismissible?: boolean }) {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      <Modal
        open={open()}
        onOpenChange={setOpen}
        title="Confirm action"
        dismissible={props.dismissible}
      >
        <p>Modal body content</p>
        <button type="button" onClick={() => setOpen(false)}>
          Done
        </button>
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

  it("hides the close button and ignores Escape and backdrop when not dismissible", async () => {
    render(() => <ModalHarness dismissible={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Open modal" }));
    const dialog = await screen.findByRole("dialog");

    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows the close button when dismissible", async () => {
    render(() => <ModalHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Open modal" }));
    await screen.findByRole("dialog");

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
