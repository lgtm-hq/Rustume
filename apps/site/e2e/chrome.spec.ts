import { test, expect } from "./support/fixtures";
import { themeMenuGroups, themeMenuItems } from "../src/data/themes";
import { DEFAULT_THEME_UNDER_TEST } from "./support/themes";
import { findAxNode, readAxTree } from "./support/ax-tree";

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

/** First and last options in the listbox, used to exercise Home and End. */
const FIRST_THEME = themeMenuItems.at(0);
const LAST_THEME = themeMenuItems.at(-1);
if (!FIRST_THEME || !LAST_THEME) {
  throw new Error("The theme menu needs at least one option for the keyboard suite");
}

/** What the picker's live region says once a theme is applied. */
function themeAnnouncement(label: string): string {
  return `Theme: ${label}`;
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
    // Closing without selecting anything must not announce a theme change.
    await expect(homePage.themeStatus).toBeEmpty();
  });

  test("Home and End move to the first and last theme option", async ({ page, homePage }) => {
    await homePage.open();
    await homePage.themeTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(homePage.themePanel).toBeVisible();

    await page.keyboard.press("End");
    await expect(homePage.themeOptionById(LAST_THEME.id)).toBeFocused();

    await page.keyboard.press("Home");
    await expect(homePage.themeOptionById(FIRST_THEME.id)).toBeFocused();

    // Movement continues from wherever focus actually is, so ArrowUp from the
    // first option wraps to the last.
    await page.keyboard.press("ArrowUp");
    await expect(homePage.themeOptionById(LAST_THEME.id)).toBeFocused();
  });

  test("selecting a theme by keyboard returns focus to the trigger and announces it", async ({
    page,
    homePage,
  }) => {
    await homePage.open();
    await homePage.themeTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(homePage.themePanel).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(homePage.themePanel).toBeHidden();
    // The panel is hidden with the `hidden` attribute while an option inside
    // it has DOM focus, so without an explicit hand-back focus falls to
    // `<body>` and the next Tab restarts at the top of the document.
    await expect(homePage.themeTrigger).toBeFocused();
    await expect(homePage.themeStatus).toHaveText(themeAnnouncement(NEXT_THEME.label));
    await expect(page.locator("html")).toHaveAttribute("data-theme", NEXT_THEME.id);
  });

  test("selecting a theme by pointer returns focus to the trigger and announces it", async ({
    homePage,
  }) => {
    await homePage.open();
    await homePage.openThemeMenu();
    await homePage.themeOptionById(NEXT_THEME.id).click();

    await expect(homePage.themePanel).toBeHidden();
    await expect(homePage.themeTrigger).toBeFocused();
    await expect(homePage.themeStatus).toHaveText(themeAnnouncement(NEXT_THEME.label));
  });

  test("reselecting the applied theme announces it again", async ({ page, homePage }) => {
    await homePage.open();
    await homePage.openThemeMenu();
    await homePage.themeOptionById(NEXT_THEME.id).click();
    await expect(homePage.themeStatus).toHaveText(themeAnnouncement(NEXT_THEME.label));

    // Count writes to the region, since the text is identical either way and
    // only a change in content is an announcement.
    await page.evaluate(() => {
      const region = document.querySelector("#theme-picker-status");
      if (!region) throw new Error("the theme status region is missing");
      const counter = { writes: 0 };
      (window as Window & { themeWrites?: { writes: number } }).themeWrites = counter;
      new MutationObserver(() => {
        counter.writes += 1;
      }).observe(region, { childList: true, characterData: true, subtree: true });
    });

    // Pick the theme that is already applied. It changes nothing on screen, so
    // the announcement is the only confirmation the interaction produces.
    await homePage.openThemeMenu();
    await homePage.themeOptionById(NEXT_THEME.id).click();
    await expect(homePage.themeStatus).toHaveText(themeAnnouncement(NEXT_THEME.label));

    const writes = await page.evaluate(
      () => (window as Window & { themeWrites?: { writes: number } }).themeWrites?.writes,
    );
    // Cleared, then refilled: two mutations, so the region genuinely changed
    // rather than being reassigned the string it already held.
    expect(writes).toBeGreaterThanOrEqual(2);
  });

  test("theme listbox owns only named groups of options", async ({
    browserName,
    page,
    homePage,
  }) => {
    test.skip(browserName !== "chromium", "Reads the accessibility tree over CDP.");
    await homePage.open();
    await homePage.openThemeMenu();

    const listbox = findAxNode(await readAxTree(page), "listbox", "Themes");
    if (!listbox) throw new Error('No listbox named "Themes" in the accessibility tree');

    // A listbox may own only `option` and `group`. Anything else here — a
    // paragraph, or the `generic` a roleless wrapper reports as — is the
    // Rustume#675 shape, where the options were grandchildren of a container
    // with no role and the group headings were orphaned text.
    expect(listbox.children.map((child) => child.role)).toEqual(themeMenuGroups.map(() => "group"));
    // Case-insensitive: the heading is `text-transform: uppercase`, and
    // Chromium computes the accessible name from the transformed text.
    expect(listbox.children.map((child) => child.name.toLowerCase())).toEqual(
      themeMenuGroups.map((group) => group.label.toLowerCase()),
    );

    // Each group owns its options and nothing else — no intermediate layout
    // container anywhere in the ownership chain, and no stray heading node.
    // The heading is `aria-hidden`, so it names the group without also sitting
    // among the options; asserting the empty list is what keeps it that way,
    // since exposing it again is the listbox-level defect repeated one level
    // down.
    for (const [index, group] of listbox.children.entries()) {
      const expected = themeMenuGroups.at(index);
      expect(group.children.filter((child) => child.role === "option")).toHaveLength(
        expected?.themes.length ?? -1,
      );
      expect(group.children.map((child) => child.role).filter((role) => role !== "option")).toEqual(
        [],
      );
    }
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
