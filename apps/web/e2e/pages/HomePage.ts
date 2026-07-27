import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Library landing page: status strip, toolbar, resume list, and empty state. */
export default class HomePage extends BasePage {
  readonly library: Locator;
  readonly statusStrip: Locator;
  readonly libraryToolbar: Locator;
  readonly newResumeButton: Locator;
  readonly emptyStateHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.library = page.getByTestId("home-library");
    this.statusStrip = page.getByTestId("home-status-strip");
    this.libraryToolbar = page.getByRole("toolbar", { name: "Resume library tools" });
    this.newResumeButton = page.getByRole("button", { name: "New resume" });
    this.emptyStateHeading = page.getByRole("heading", { name: "Your library is empty" });
  }

  async open(): Promise<void> {
    await this.page.goto("/");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.statusStrip).toBeVisible();
    await expect(this.libraryToolbar).toBeVisible();
  }

  async assertEmptyState(): Promise<void> {
    await expect(this.emptyStateHeading).toBeVisible();
  }

  /** A stored resume shows up in the list with the given display title. */
  async assertResumeListed(title: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name: title })).toBeVisible();
  }

  async createResume(): Promise<void> {
    await this.newResumeButton.click();
  }
}
