import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** "Choose Template" modal: template grid, lightbox preview, selection. */
export default class TemplatePickerModal extends BasePage {
  readonly dialog: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole("dialog", { name: "Choose Template" });
    this.cancelButton = this.dialog.getByRole("button", { name: "Cancel" });
  }

  async assertOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async assertClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  /** A template card with the given display name is shown in the grid. */
  async assertTemplateListed(displayName: string): Promise<void> {
    await expect(
      this.dialog.getByRole("heading", { name: displayName, exact: true }),
    ).toBeVisible();
  }

  /**
   * Select a template from the grid. The action buttons reveal on card
   * hover, so hover the card title first.
   */
  async selectTemplate(displayName: string): Promise<void> {
    await this.dialog.getByRole("heading", { name: displayName, exact: true }).hover();
    await this.dialog.getByRole("button", { name: `Use ${displayName} template` }).click();
  }

  /** Open the lightbox preview for a template. */
  async previewTemplate(displayName: string): Promise<void> {
    await this.dialog.getByRole("heading", { name: displayName, exact: true }).hover();
    await this.dialog.getByRole("button", { name: `Preview ${displayName} template` }).click();
  }

  /** The lightbox preview shows the template image and a Use button. */
  async assertPreviewOpen(displayName: string): Promise<void> {
    await expect(
      this.dialog.getByRole("img", { name: `${displayName} template preview` }),
    ).toBeVisible();
    await expect(this.dialog.getByRole("button", { name: "Use Template" })).toBeVisible();
  }

  /** Confirm the selection from within the lightbox preview. */
  async useTemplateFromPreview(): Promise<void> {
    await this.dialog.getByRole("button", { name: "Use Template" }).click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
