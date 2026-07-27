import { expect, type Locator, type Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Any page under /docs/ — the layout, title and chrome are shared. */
export default class DocsPage extends BasePage {
  /** Page title rendered by the docs layouts. */
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { level: 1 });
  }

  /** Opens a docs entry by slug, e.g. `getting-started/quickstart`. */
  async open(slug: string): Promise<void> {
    await super.open(`/docs/${slug}/`);
  }

  async assertLoaded(title: string): Promise<void> {
    await expect(this.heading).toHaveText(title);
  }
}
