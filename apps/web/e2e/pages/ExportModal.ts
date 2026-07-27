import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** "Export Resume" modal: PDF and JSON download options. */
export default class ExportModal extends BasePage {
  readonly dialog: Locator;
  readonly pdfOption: Locator;
  readonly jsonOption: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole("dialog", { name: "Export Resume" });
    this.pdfOption = this.dialog.getByRole("button", { name: /PDF Document/ });
    this.jsonOption = this.dialog.getByRole("button", { name: /JSON Data/ });
  }

  async assertOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async assertClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  async exportPdf(): Promise<void> {
    await this.pdfOption.click();
  }

  async exportJson(): Promise<void> {
    await this.jsonOption.click();
  }
}
