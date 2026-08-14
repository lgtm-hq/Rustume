import { expect, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import BasePage from "./BasePage";

/**
 * Document editor (/edit/:id): the single centered sheet surface (#785) with
 * the Edit/Done toggle and the toolbar chrome around it. The app's only
 * editing surface since #735 retired the form builder.
 */
export default class DocEditorPage extends BasePage {
  readonly sheet: Locator;
  readonly surface: Locator;
  /** Page-count pill: outside the scaled `.doc-sheet` subtree (#813). */
  readonly pageCount: Locator;
  readonly modeToggle: Locator;
  readonly header: Locator;
  readonly savedIndicator: Locator;
  readonly unsavedIndicator: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly themeButton: Locator;
  readonly templatesTab: Locator;
  readonly sectionsTab: Locator;

  constructor(page: Page) {
    super(page);
    this.sheet = page.getByTestId("doc-sheet");
    this.surface = page.getByTestId("doc-editor-surface");
    this.pageCount = page.getByTestId("doc-sheet-page-count");
    this.modeToggle = page.getByTestId("doc-editor-mode-toggle");
    this.header = page.getByTestId("doc-sheet-header");
    this.savedIndicator = page.getByText("Saved", { exact: true });
    this.unsavedIndicator = page.getByText("Unsaved", { exact: true });
    this.importButton = page.getByRole("button", { name: "Import", exact: true });
    this.exportButton = page.getByRole("button", { name: "Export", exact: true });
    this.themeButton = page.getByTestId("doc-editor-theme-button");
    this.templatesTab = page.getByTestId("doc-editor-templates-tab");
    this.sectionsTab = page.getByTestId("doc-editor-sections-tab");
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/edit/${id}`);
  }

  /** The document sheet serves the route. */
  async assertDocEditorOpen(): Promise<void> {
    await expect(this.sheet).toBeVisible();
    await expect(this.surface).toBeVisible();
    // Single surface (#785): no split preview pane.
    await expect(this.page.getByTestId("doc-editor-preview-pane")).toHaveCount(0);
  }

  /** The sheet's current mode, from its own data attribute. */
  async assertMode(mode: "edit" | "done"): Promise<void> {
    await expect(this.sheet).toHaveAttribute("data-sheet-mode", mode);
  }

  /** Flip between Edit and Done via the top-bar toggle. */
  async toggleMode(): Promise<void> {
    await this.modeToggle.click();
  }

  /**
   * Put the sheet in Edit mode if it is not already. A non-empty resume
   * settles in Done mode on load, so flows that edit after a reload go
   * through here first.
   */
  async ensureEditMode(): Promise<void> {
    if ((await this.sheet.getAttribute("data-sheet-mode")) !== "edit") {
      await this.toggleMode();
    }
    await this.assertMode("edit");
  }

  /**
   * The modal-edit trigger for a sheet-header field, e.g. "Name". Its
   * accessible name is the current value (or the placeholder while empty);
   * the `title` hint identifies the field regardless of its value.
   */
  headerField(field: string): Locator {
    return this.header.getByTitle(`Double-click to edit ${field.toLowerCase()}`, { exact: true });
  }

  /** Commit `name` through the header's typed field dialog (#795). */
  async fillName(name: string): Promise<void> {
    await this.ensureEditMode();
    await this.headerField("Name").dblclick();
    const dialog = this.page.getByRole("dialog", { name: "Edit · Name" });
    await dialog.getByRole("textbox", { name: "Name" }).fill(name);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
  }

  /** The header shows `name` — as the heading in either mode. */
  async assertName(name: string): Promise<void> {
    await expect(this.header.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  /** The debounced auto-save completed (app-shell indicator settled on Saved). */
  async assertSaved(): Promise<void> {
    await expect(this.savedIndicator).toBeVisible();
  }

  /** There are pending edits (app-shell indicator shows Unsaved). */
  async assertUnsaved(): Promise<void> {
    await expect(this.unsavedIndicator).toBeVisible();
  }

  /**
   * The items drawn for one section of the sheet. Every drawn entry carries
   * `data-entry-id`, whatever its body layout — full rows are `<article>`s,
   * but compact lists (interests) and chip lists are not.
   */
  sectionItems(sectionId: string): Locator {
    return this.page.locator(`[data-section-id="${sectionId}"] [data-entry-id]`);
  }

  async assertSectionItemCount(sectionId: string, count: number): Promise<void> {
    await expect(this.sectionItems(sectionId)).toHaveCount(count);
  }

  /**
   * Add an item through a section's "Add <noun>" affordance, filling the
   * typed item dialog (#795): `Add · <Section title>`, committed by its own
   * "Add" button.
   */
  async addItem(noun: string, fields: readonly (readonly [string, string])[]): Promise<void> {
    await this.ensureEditMode();
    await this.page
      .getByRole("button", { name: `Add ${noun}`, exact: true })
      .first()
      .click();
    const dialog = this.page.getByRole("dialog", { name: /^Add · / });
    await expect(dialog).toBeVisible();
    for (const [label, value] of fields) {
      await dialog.getByLabel(label, { exact: true }).fill(value);
    }
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  /**
   * Open the typed edit dialog of the item labelled `label`. The row's edit
   * pencil is hover/focus chrome layered under the row body, so it is
   * activated through focus rather than a pointer click.
   */
  async openItemDialog(label: string): Promise<Locator> {
    await this.ensureEditMode();
    const edit = this.page.getByRole("button", { name: `Edit ${label}`, exact: true });
    await edit.focus();
    await this.page.keyboard.press("Enter");
    const dialog = this.page.getByRole("dialog", { name: /^Edit · / });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  /**
   * Delete the item labelled `label` via its own remove control. Compact rows
   * (skills, languages, …) keep their action buttons keyboard-only, so the
   * control is activated through focus rather than a pointer click.
   */
  async deleteItem(label: string): Promise<void> {
    await this.ensureEditMode();
    const remove = this.page.getByRole("button", { name: `Remove ${label}`, exact: true });
    await remove.focus();
    await this.page.keyboard.press("Enter");
  }

  async openImportModal(): Promise<void> {
    await this.importButton.click();
  }

  async openExportModal(): Promise<void> {
    await this.exportButton.click();
  }

  /** Expand the Templates drawer from its edge tab on the resume surface. */
  async openTemplatesDrawer(): Promise<void> {
    await this.templatesTab.click();
  }

  /** Expand the Sections panel from its edge tab on the resume surface. */
  async openSectionsPanel(): Promise<void> {
    await this.sectionsTab.click();
  }
}
