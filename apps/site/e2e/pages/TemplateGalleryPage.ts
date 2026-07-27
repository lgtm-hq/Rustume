import { expect, type Locator, type Page } from "@playwright/test";
import DocsPage from "./DocsPage";

/** Docs slug that renders `TemplateGallery.astro`. */
const TEMPLATES_SLUG = "getting-started/templates";

/** Template gallery page and its preview dialog. */
export default class TemplateGalleryPage extends DocsPage {
  /** Gallery region holding one button per template. */
  readonly gallery: Locator;

  /** Preview dialog, moved to the document body and revealed on card click. */
  readonly previewDialog: Locator;

  /** Close control inside the preview dialog. */
  readonly previewCloseButton: Locator;

  constructor(page: Page) {
    super(page);
    this.gallery = page.getByRole("region", { name: "Template previews" });
    // Filtered by its close control so it can never resolve to the header's
    // search dialog, which shares the role.
    this.previewDialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: "Close preview" }) });
    this.previewCloseButton = this.previewDialog.getByRole("button", { name: "Close preview" });
  }

  async open(): Promise<void> {
    await super.open(TEMPLATES_SLUG);
  }

  /** Preview button for one template card. */
  previewCard(templateId: string): Locator {
    return this.gallery.getByRole("button", { name: `Preview ${templateId} template` });
  }

  async assertGalleryLoaded(): Promise<void> {
    await expect(this.gallery).toBeVisible();
    await expect(this.gallery.getByRole("button")).not.toHaveCount(0);
  }

  /** Opens one template's preview dialog and waits for it to take focus. */
  async openPreview(templateId: string): Promise<void> {
    await this.previewCard(templateId).click();
    await expect(this.previewDialog).toBeVisible();
    await expect(this.previewDialog).toHaveAttribute("aria-modal", "true");
    await expect(this.previewCloseButton).toBeFocused();
  }

  /** Closes the preview dialog with Escape. */
  async closePreview(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.previewDialog).toBeHidden();
  }
}
