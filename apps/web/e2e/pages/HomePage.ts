import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Landing page: hero, resume list, and empty state. */
export default class HomePage extends BasePage {
  readonly heroHeading: Locator;
  readonly createResumeButton: Locator;
  readonly resumeListHeading: Locator;
  readonly emptyStateHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.heroHeading = page.getByRole("heading", { name: /Build your resume/ });
    this.createResumeButton = page.getByRole("button", { name: "Create New Resume" });
    this.resumeListHeading = page.getByRole("heading", { name: "Your Resumes" });
    this.emptyStateHeading = page.getByRole("heading", { name: "No resumes yet" });
  }

  async open(): Promise<void> {
    await this.page.goto("/");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.heroHeading).toBeVisible();
    await expect(this.resumeListHeading).toBeVisible();
  }

  async assertEmptyState(): Promise<void> {
    await expect(this.emptyStateHeading).toBeVisible();
  }

  /** A stored resume shows up in the list with the given display title. */
  async assertResumeListed(title: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name: title })).toBeVisible();
  }

  async createResume(): Promise<void> {
    await this.createResumeButton.click();
  }
}
