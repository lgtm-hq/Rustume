import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Document editor (/edit/:id): the paged sheet surface, default since #734. */
export default class DocEditorPage extends BasePage {
  readonly sheet: Locator;
  readonly sheetPane: Locator;

  constructor(page: Page) {
    super(page);
    this.sheet = page.getByTestId("doc-sheet");
    this.sheetPane = page.getByTestId("doc-editor-sheet-pane");
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/edit/${id}`);
  }

  /** `/edit/:id` with a flag request, e.g. `form-builder` or `off`. */
  async openWithFlag(id: string, flag: string): Promise<void> {
    await this.page.goto(`/edit/${id}?ff=${flag}`);
  }

  /** The document sheet serves the route (and the form editor does not). */
  async assertDocEditorOpen(): Promise<void> {
    await expect(this.sheet).toBeVisible();
    await expect(this.sheetPane).toBeVisible();
  }
}
