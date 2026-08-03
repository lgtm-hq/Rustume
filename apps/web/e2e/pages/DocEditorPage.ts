import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Document editor (/edit/:id): the single centered sheet surface (#785). */
export default class DocEditorPage extends BasePage {
  readonly sheet: Locator;
  readonly surface: Locator;
  readonly modeToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.sheet = page.getByTestId("doc-sheet");
    this.surface = page.getByTestId("doc-editor-surface");
    this.modeToggle = page.getByTestId("doc-editor-mode-toggle");
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
    await expect(this.surface).toBeVisible();
    // Single surface (#785): no split preview pane.
    await expect(this.page.getByTestId("doc-editor-preview-pane")).toHaveCount(0);
    await expect(
      this.page.getByRole("heading", { name: "Personal Information", exact: true }),
    ).toBeHidden();
  }

  /** The sheet's current mode, from its own data attribute. */
  async assertMode(mode: "edit" | "done"): Promise<void> {
    await expect(this.sheet).toHaveAttribute("data-sheet-mode", mode);
  }

  /** Flip between Edit and Done via the top-bar toggle. */
  async toggleMode(): Promise<void> {
    await this.modeToggle.click();
  }
}
