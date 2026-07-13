import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { render } from "@solidjs/testing-library";
import { axeConfig } from "../../../test/a11y";
import { Modal } from "../Modal";

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
});
