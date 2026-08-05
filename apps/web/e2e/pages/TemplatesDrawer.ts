import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/**
 * The templates drawer opened from the document editor's toolbar. Cards come
 * from `GET /api/templates`; selecting one applies the template and closes the
 * drawer.
 */
export default class TemplatesDrawer extends BasePage {
  readonly dialog: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole("dialog", { name: "Templates" });
  }

  async assertOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async assertClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  /** The card for `name`, e.g. "Azurill". */
  card(name: string): Locator {
    return this.dialog.getByRole("button", { name: `Use ${name} template`, exact: true });
  }

  async assertTemplateListed(name: string): Promise<void> {
    await expect(this.card(name)).toBeVisible();
  }

  /** The card for `name` is marked as the current template. */
  async assertCurrentTemplate(name: string): Promise<void> {
    await expect(this.card(name)).toHaveAttribute("aria-pressed", "true");
  }

  async selectTemplate(name: string): Promise<void> {
    await this.card(name).click();
  }

  /** Dismiss the drawer without selecting anything. */
  async dismiss(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}
