import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/**
 * Home ("library") page: scope rail, library toolbar, and the resume cards.
 *
 * The library renders one of three layouts (list / grid / gallery). A fresh
 * browser context has no stored preference, so these tests always see the
 * Grid default; every locator below is layout-agnostic regardless.
 */
export default class HomePage extends BasePage {
  /** Always-present library toolbar — the "library shell rendered" anchor. */
  readonly libraryToolbar: Locator;
  readonly createResumeButton: Locator;
  readonly importResumeButton: Locator;
  readonly searchInput: Locator;
  readonly emptyStateHeading: Locator;
  readonly sidebarToggle: Locator;
  readonly scopeRail: Locator;
  readonly renameInput: Locator;
  readonly confirmRenameButton: Locator;

  constructor(page: Page) {
    super(page);
    this.libraryToolbar = page.getByRole("toolbar", { name: "Resume library tools" });
    // Exact: the empty state offers a separate "Create Resume" button, and the
    // command palette lists a "New resume" action.
    this.createResumeButton = this.libraryToolbar.getByRole("button", {
      name: "New resume",
      exact: true,
    });
    this.importResumeButton = this.libraryToolbar.getByRole("button", {
      name: "Import",
      exact: true,
    });
    this.searchInput = page.getByRole("textbox", { name: "Search resumes" });
    this.emptyStateHeading = page.getByRole("heading", { name: "Your library is empty" });
    this.sidebarToggle = this.libraryToolbar.getByRole("button", { name: "Toggle sidebar" });
    this.scopeRail = page.getByRole("navigation", { name: "Library scope" });
    this.renameInput = page.getByRole("textbox", { name: "Rename resume" });
    this.confirmRenameButton = page.getByRole("button", { name: "Confirm rename" });
  }

  async open(): Promise<void> {
    await this.page.goto("/");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.libraryToolbar).toBeVisible();
    await expect(this.createResumeButton).toBeEnabled();
  }

  async assertEmptyState(): Promise<void> {
    await expect(this.emptyStateHeading).toBeVisible();
  }

  /** A stored resume shows up in the library with the given display title. */
  async assertResumeListed(title: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name: title })).toBeVisible();
  }

  async assertResumeNotListed(title: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name: title })).toBeHidden();
  }

  /** Number of resumes shown in the library. */
  async assertResumeCount(count: number): Promise<void> {
    await expect(this.page.getByTestId("resume-card")).toHaveCount(count);
  }

  async createResume(): Promise<void> {
    await this.createResumeButton.click();
  }

  /** Open the scope rail (folders, tags, storage) if it is not already shown. */
  async openScopeRail(): Promise<void> {
    if (await this.scopeRail.isVisible()) return;
    await this.sidebarToggle.click();
    await expect(this.scopeRail).toBeVisible();
  }

  /** Library card for the given resume title. */
  private resumeCard(title: string | RegExp): Locator {
    return this.page
      .getByTestId("resume-card")
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

  /** Open a listed resume in the editor via its card link. */
  async openResume(title: string | RegExp): Promise<void> {
    await this.resumeCard(title).getByRole("link").first().click();
  }
}
