import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Landing page: hero, resume list, and empty state. */
export default class HomePage extends BasePage {
  readonly heroHeading: Locator;
  readonly createResumeButton: Locator;
  readonly resumeListHeading: Locator;
  readonly emptyStateHeading: Locator;
  readonly renameInput: Locator;
  readonly confirmRenameButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heroHeading = page.getByRole("heading", { name: /Build your resume/ });
    this.createResumeButton = page.getByRole("button", { name: "Create New Resume" });
    this.resumeListHeading = page.getByRole("heading", { name: "Your Resumes" });
    this.emptyStateHeading = page.getByRole("heading", { name: "No resumes yet" });
    this.renameInput = page.getByTestId("rename-input");
    this.confirmRenameButton = page.getByRole("button", { name: "Confirm rename" });
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

  async assertResumeNotListed(title: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name: title })).toBeHidden();
  }

  /** Number of resumes shown in the list (one delete action per row). */
  async assertResumeCount(count: number): Promise<void> {
    await expect(this.page.getByRole("button", { name: "Delete resume" })).toHaveCount(count);
  }

  async createResume(): Promise<void> {
    await this.createResumeButton.click();
  }

  /** List row (card) that contains the given resume title. */
  private resumeCard(title: string | RegExp): Locator {
    return this.page
      .locator("div.group")
      .filter({ has: this.page.getByRole("heading", { level: 3, name: title }) });
  }

  /** Rename a listed resume via the inline rename flow. */
  async renameResume(currentTitle: string | RegExp, newTitle: string): Promise<void> {
    await this.resumeCard(currentTitle).getByRole("button", { name: "Rename resume" }).click();
    await this.renameInput.fill(newTitle);
    await this.confirmRenameButton.click();
  }

  /**
   * Delete a listed resume. The app asks for confirmation via a native
   * `confirm()` dialog; `accept` controls the dialog response.
   */
  async deleteResume(title: string | RegExp, accept = true): Promise<void> {
    this.page.once("dialog", (dialog) => {
      void (accept ? dialog.accept() : dialog.dismiss());
    });
    await this.resumeCard(title).getByRole("button", { name: "Delete resume" }).click();
  }

  async duplicateResume(title: string | RegExp): Promise<void> {
    await this.resumeCard(title).getByRole("button", { name: "Duplicate resume" }).click();
  }

  /** Open a listed resume in the editor via its row link. */
  async openResume(title: string | RegExp): Promise<void> {
    await this.resumeCard(title).getByRole("link").first().click();
  }
}
