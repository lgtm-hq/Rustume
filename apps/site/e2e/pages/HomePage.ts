import { expect, type Locator, type Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Marketing landing page at the site root. */
export default class HomePage extends BasePage {
  /** Hero headline. */
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { level: 1 });
  }

  async open(): Promise<void> {
    await super.open("/");
  }

  async assertLoaded(): Promise<void> {
    await expect(this.heading).toContainText("Forge resumes with");
  }
}
