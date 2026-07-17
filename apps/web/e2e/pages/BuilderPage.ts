import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Resume editor (/edit/:id): basics form, save indicator, live preview. */
export default class BuilderPage extends BasePage {
  readonly basicsHeading: Locator;
  readonly fullNameInput: Locator;
  readonly savedIndicator: Locator;
  readonly unsavedIndicator: Locator;
  readonly previewImage: Locator;

  constructor(page: Page) {
    super(page);
    this.basicsHeading = page.getByRole("heading", { name: "Personal Information" });
    this.fullNameInput = page.getByLabel("Full Name");
    this.savedIndicator = page.getByText("Saved", { exact: true });
    this.unsavedIndicator = page.getByText("Unsaved", { exact: true });
    this.previewImage = page.getByRole("img", { name: "Resume preview" });
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/edit/${id}`);
  }

  async assertEditorOpen(): Promise<void> {
    await this.assertUrl(/\/edit\/[\w-]+/);
    await expect(this.basicsHeading).toBeVisible();
  }

  async fillFullName(name: string): Promise<void> {
    await this.fullNameInput.fill(name);
  }

  async assertFullName(name: string): Promise<void> {
    await expect(this.fullNameInput).toHaveValue(name);
  }

  /** The debounced auto-save completed (header indicator settled on Saved). */
  async assertSaved(): Promise<void> {
    await expect(this.savedIndicator).toBeVisible();
  }

  async assertPreviewVisible(): Promise<void> {
    await expect(this.previewImage).toBeVisible();
  }
}
