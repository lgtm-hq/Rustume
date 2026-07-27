import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** "Import Resume" modal: drop zone with a hidden file input. */
export default class ImportModal extends BasePage {
  readonly dialog: Locator;
  /** Structural locator: the drop zone's file input has no label. */
  readonly fileInput: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole("dialog", { name: "Import Resume" });
    this.fileInput = this.dialog.locator('input[type="file"]');
  }

  async assertOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async assertClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  /** Import a file from disk through the drop zone input. */
  async importFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  /** Import an in-memory payload through the drop zone input. */
  async importBuffer(name: string, mimeType: string, buffer: Buffer): Promise<void> {
    await this.fileInput.setInputFiles({ name, mimeType, buffer });
  }

  /** The inline error panel shows the given message. */
  async assertError(message: string | RegExp): Promise<void> {
    await expect(this.dialog.getByText(message)).toBeVisible();
  }
}
