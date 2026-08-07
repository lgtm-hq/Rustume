import { test, expect } from "./support/fixtures";
import type { Locator, Page } from "@playwright/test";

/**
 * Custom-section lifecycle from the Sections panel (#795 rework): adding,
 * hiding and deleting a custom section must reflect immediately on both the
 * panel's own list and the sheet — no close/reopen, no clicking out.
 */
/**
 * The sheet card whose section title reads `title` (never the live region).
 * Text-filtered, not role-filtered: with the Sections drawer open the sheet
 * sits behind the modal overlay's aria-hidden, which suppresses roles.
 */
function sheetCard(page: Page, title: string): Locator {
  return page.getByTestId("doc-sheet").locator("[data-section-id]").filter({ hasText: title });
}

/**
 * Wait for the save caused by the preceding mutation to land.
 *
 * "Saved" alone can be a stale pass — the indicator may still show a prior
 * save. A mutation flips the status off "Saved" synchronously (dirty for the
 * 1s autosave debounce), so observing the transition — not-saved, then
 * saved — pins the new write.
 */
async function expectMutationSaved(page: Page): Promise<void> {
  await expect(page.getByText(/^(Unsaved|Saving\.\.\.)$/)).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function addCustomSection(page: Page, panel: Locator, title: string): Promise<void> {
  await panel.getByRole("button", { name: "Add section" }).click();
  const dialog = page.getByRole("dialog", { name: "Add section" });
  await dialog.getByRole("textbox", { name: "Section title" }).fill(title);
  await dialog.getByRole("button", { name: "Add section" }).click();
}

test.describe("custom sections from the panel", () => {
  test("add, hide, and delete reflect immediately in panel and sheet", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertMode("edit");

    await page.getByRole("button", { name: "Sections", exact: true }).click();
    const panel = page.getByTestId("sections-panel");
    await expect(panel).toBeVisible();

    // Add: the panel's CUSTOM SECTIONS list updates without close/reopen…
    await addCustomSection(page, panel, "Field Notes");
    const row = panel.getByRole("switch", { name: "Field Notes" });
    await expect(row).toBeVisible();
    await expect(row).toBeChecked();
    // …and the sheet draws the new section at once.
    await expect(sheetCard(page, "Field Notes")).toHaveCount(1);

    // Hide from the panel toggle: gone from the sheet immediately. The
    // Kobalte switch input sits under its label, so click the label.
    await panel.getByText("Field Notes", { exact: true }).click();
    await expect(row).not.toBeChecked();
    await expect(sheetCard(page, "Field Notes")).toHaveCount(0);

    // Show again: back at once.
    await panel.getByText("Field Notes", { exact: true }).click();
    await expect(row).toBeChecked();
    await expect(sheetCard(page, "Field Notes")).toHaveCount(1);

    // Delete goes through the confirm dialog (#797): cancelling keeps the
    // section, confirming removes it from panel list and sheet immediately.
    await panel.getByRole("button", { name: "Delete Field Notes section" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete section?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(panel.getByRole("switch", { name: "Field Notes" })).toHaveCount(1);

    await panel.getByRole("button", { name: "Delete Field Notes section" }).click();
    await confirm.getByRole("button", { name: "Delete section" }).click();
    await expect(panel.getByRole("switch", { name: "Field Notes" })).toHaveCount(0);
    await expect(sheetCard(page, "Field Notes")).toHaveCount(0);
  });

  test("item fields saved in the dialog draw on the sheet (#821)", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertMode("edit");

    await page.getByRole("button", { name: "Sections", exact: true }).click();
    const panel = page.getByTestId("sections-panel");
    await expect(panel).toBeVisible();
    await addCustomSection(page, panel, "Talks");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    const card = sheetCard(page, "Talks");
    await card.getByRole("button", { name: "Add talk" }).click();
    const dialog = page.getByRole("dialog", { name: "Add · Talks" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Design Tokens");
    await dialog.getByRole("textbox", { name: "Description" }).fill("Clarity Conference");
    await dialog.getByRole("textbox", { name: "Date" }).fill("May 2025");
    await dialog.getByRole("textbox", { name: "Location" }).fill("Amsterdam");
    const tags = dialog.getByRole("textbox", { name: "Tags" });
    await tags.fill("Design Systems");
    await tags.press("Enter");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();

    // Every dialog field draws on the sheet — not just the name (#821).
    await expect(card).toContainText("Design Tokens");
    await expect(card).toContainText("Clarity Conference");
    await expect(card).toContainText("May 2025");
    await expect(card).toContainText("Amsterdam");
    await expect(card).toContainText("Design Systems");
  });

  test("a custom section survives autosave, reload, and a post-reload edit", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertMode("edit");

    await page.getByRole("button", { name: "Sections", exact: true }).click();
    const panel = page.getByTestId("sections-panel");
    await addCustomSection(page, panel, "Persistent");
    await expect(panel.getByRole("switch", { name: "Persistent" })).toBeVisible();

    // Let the autosave caused by the add land before reloading.
    await expectMutationSaved(page);
    await page.reload();
    await expect(docEditorPage.sheet).toBeVisible();

    // The wasm load boundary must hand back plain objects: a Map-shaped
    // sections.custom made the panel list empty after reload and the next
    // autosave wiped the section from storage for good.
    if ((await docEditorPage.sheet.getAttribute("data-sheet-mode")) === "done") {
      await docEditorPage.toggleMode();
    }
    await docEditorPage.assertMode("edit");
    await expect(sheetCard(page, "Persistent")).toHaveCount(1);

    await page.getByRole("button", { name: "Sections", exact: true }).click();
    const reopened = page.getByTestId("sections-panel");
    const row = reopened.getByRole("switch", { name: "Persistent" });
    await expect(row).toBeVisible();
    await expect(row).toBeChecked();

    // Post-reload writes must land in the real entries, not as expandos.
    await reopened.getByText("Persistent", { exact: true }).click();
    await expect(row).not.toBeChecked();
    await expect(sheetCard(page, "Persistent")).toHaveCount(0);

    // And the toggled state persists through another save/reload cycle.
    await expectMutationSaved(page);
    await page.reload();
    await expect(docEditorPage.sheet).toBeVisible();
    await page.getByRole("button", { name: "Sections", exact: true }).click();
    const afterSecondReload = page.getByTestId("sections-panel");
    const persistedRow = afterSecondReload.getByRole("switch", { name: "Persistent" });
    await expect(persistedRow).toBeVisible();
    await expect(persistedRow).not.toBeChecked();
  });

  test("hide from the section pencil menu removes the custom section from the sheet", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertMode("edit");

    await page.getByRole("button", { name: "Sections", exact: true }).click();
    const panel = page.getByTestId("sections-panel");
    await addCustomSection(page, panel, "Pencil Hide");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    const card = sheetCard(page, "Pencil Hide");
    await expect(card).toHaveCount(1);
    await card.getByRole("button", { name: /section options/ }).click();
    await page.getByRole("menuitem", { name: /Hide .* section/ }).click();

    await expect(card).toHaveCount(0);
    // The panel's toggle reflects the hidden state.
    await page.getByRole("button", { name: "Sections", exact: true }).click();
    await expect(panel.getByRole("switch", { name: "Pencil Hide" })).not.toBeChecked();
  });
});
