import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/** Resume editor (/edit/:id): basics form, save indicator, live preview. */
export default class BuilderPage extends BasePage {
  readonly basicsHeading: Locator;
  readonly fullNameInput: Locator;
  readonly savedIndicator: Locator;
  readonly unsavedIndicator: Locator;
  readonly previewImage: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;
  /** "Add" button in the header of the active section editor. */
  readonly addItemButton: Locator;

  constructor(page: Page) {
    super(page);
    this.basicsHeading = page.getByRole("heading", { name: "Personal Information" });
    this.fullNameInput = page.getByLabel("Full Name");
    this.savedIndicator = page.getByText("Saved", { exact: true });
    this.unsavedIndicator = page.getByText("Unsaved", { exact: true });
    this.previewImage = page.getByRole("img", { name: "Resume preview" });
    this.importButton = page.getByRole("button", { name: "Import", exact: true });
    this.exportButton = page.getByRole("button", { name: "Export", exact: true });
    this.addItemButton = page.getByRole("button", { name: "Add", exact: true });
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/edit/${id}`);
  }

  async assertEditorOpen(): Promise<void> {
    await this.assertUrl(/\/edit\/[\w-]+/);
    await expect(this.basicsHeading).toBeVisible();
  }

  async fillFullName(name: string): Promise<void> {
    await this.fullNameInput.fill(name);
  }

  async assertFullName(name: string): Promise<void> {
    await expect(this.fullNameInput).toHaveValue(name);
  }

  /** The debounced auto-save completed (header indicator settled on Saved). */
  async assertSaved(): Promise<void> {
    await expect(this.savedIndicator).toBeVisible();
  }

  /** There are pending edits (header indicator shows Unsaved). */
  async assertUnsaved(): Promise<void> {
    await expect(this.unsavedIndicator).toBeVisible();
  }

  async assertPreviewVisible(): Promise<void> {
    await expect(this.previewImage).toBeVisible();
  }

  /** Switch section tabs via the sidebar (buttons are labelled per tab). */
  async openSection(sidebarLabel: string): Promise<void> {
    await this.page.getByRole("button", { name: sidebarLabel, exact: true }).first().click();
  }

  /** The active section editor shows its title heading. */
  async assertSectionOpen(title: string): Promise<void> {
    await expect(this.page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }

  /** Add an item to the active section via the header "Add" button. */
  async addSectionItem(): Promise<void> {
    await this.addItemButton.click();
  }

  /** The active section editor header reports the given item count. */
  async assertSectionItemCount(count: number): Promise<void> {
    await expect(this.page.getByText(`${count} items`, { exact: true })).toBeVisible();
  }

  /** Fill a labelled field inside the expanded section item form. */
  async fillItemField(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).fill(value);
  }

  async assertItemField(label: string, value: string): Promise<void> {
    await expect(this.page.getByLabel(label, { exact: true })).toHaveValue(value);
  }

  /** Expand a collapsed section item by the title shown in its row header. */
  async expandItem(title: string): Promise<void> {
    await this.page.getByRole("button", { name: title }).first().click();
  }

  async openImportModal(): Promise<void> {
    await this.importButton.click();
  }

  async openExportModal(): Promise<void> {
    await this.exportButton.click();
  }

  /**
   * Open the TemplatePicker via the toolbar template button. Its accessible
   * name is the currently selected template id (e.g. "rhyhorn").
   */
  async openTemplatePicker(currentTemplateId: string): Promise<void> {
    await this.page.getByRole("button", { name: currentTemplateId, exact: true }).click();
  }

  /** The toolbar template button reflects the selected template id. */
  async assertSelectedTemplate(templateId: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: templateId, exact: true })).toBeVisible();
  }
}
