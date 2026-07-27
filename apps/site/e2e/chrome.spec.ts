import { test, expect } from "./support/fixtures";
import { themeMenuItems } from "../src/data/themes";
import { DEFAULT_THEME_UNDER_TEST } from "./support/themes";

/**
 * Keyboard and ARIA behaviour of the header chrome — the interactive surfaces
 * an axe scan can only partly speak to, since it sees one rendered state and
 * not the transitions between them.
 */

/** First option after the default one, used to exercise arrow-key movement. */
const NEXT_THEME = themeMenuItems[1];
if (!NEXT_THEME) {
  throw new Error("The theme menu needs at least two options for the keyboard suite");
}

test.describe("site chrome", () => {
  test("skip link is the first tab stop and moves focus to main", async ({ page, homePage }) => {
    await homePage.open();
    await page.keyboard.press("Tab");
    await expect(homePage.skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(homePage.main).toBeFocused();
    await homePage.assertUrl(/#main-content$/);
  });

  test("header brand and main nav do not overlap", async ({ homePage }) => {
    await homePage.open();
    const brand = await homePage.brandLink.boundingBox();
    const firstNavLink = await homePage.mainNav.getByRole("link").first().boundingBox();
    if (!brand || !firstNavLink) {
      throw new Error("Header brand and nav must both be rendered");
    }
    // Guards the turbo-themes#747 bug class: a nav item painted over the brand.
    expect(brand.x + brand.width).toBeLessThanOrEqual(firstNavLink.x);
  });

  test("theme picker is operable by keyboard and applies the chosen theme", async ({
    page,
    homePage,
  }) => {
    await homePage.open();
    await homePage.themeTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(homePage.themePanel).toBeVisible();

    await page.keyboard.press("ArrowDown");
    const nextOption = homePage.themePanel.getByRole("option", {
      name: NEXT_THEME.label,
      exact: true,
    });
    await expect(nextOption).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(homePage.themePanel).toBeHidden();
    await expect(homePage.themeTrigger).toContainText(NEXT_THEME.label);
    await expect(page.locator("html")).toHaveAttribute("data-theme", NEXT_THEME.id);

    // Reopen: the options only exist in the a11y tree while the panel is shown.
    await homePage.openThemeMenu();
    await expect(nextOption).toHaveAttribute("aria-selected", "true");
  });

  test("theme picker closes on Escape and returns focus to its trigger", async ({
    page,
    homePage,
  }) => {
    await homePage.open();
    await homePage.openThemeMenu();
    await page.keyboard.press("Escape");
    await expect(homePage.themePanel).toBeHidden();
    await expect(homePage.themeTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(homePage.themeTrigger).toBeFocused();
    // Escape must not have changed the applied theme.
    await homePage.assertThemeApplied(DEFAULT_THEME_UNDER_TEST);
  });

  test("search opens with the keyboard shortcut and closes on Escape", async ({ homePage }) => {
    await homePage.open();
    await homePage.openSearchWithShortcut();
    await homePage.closeSearch();
    await expect(homePage.searchTrigger).toBeFocused();
  });

  test("search dialog mounts the Pagefind UI from the built index", async ({ homePage }) => {
    await homePage.open();
    await homePage.openSearch();
    // The fallback message renders when the Pagefind bundle fails to mount, so
    // asserting the real input guards the search UI actually being there.
    await expect(homePage.searchInput).toBeVisible();
  });
});
