import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Account page (/account). In local mode it explains cloud availability. */
export default class AccountPage extends BasePage {
  readonly accountHeading: Locator;
  readonly localModeNotice: Locator;

  constructor(page: Page) {
    super(page);
    this.accountHeading = page.getByRole("heading", { name: "Account", exact: true });
    this.localModeNotice = page.getByText(
      "Cloud accounts are only available on Rustume Cloud deployments.",
    );
  }

  async open(): Promise<void> {
    await this.page.goto("/account");
  }

  /** Local (self-hosted) mode: no cloud account UI, explanatory notice. */
  async assertLocalMode(): Promise<void> {
    await expect(this.accountHeading).toBeVisible();
    await expect(this.localModeNotice).toBeVisible();
  }
}
