import type { Page } from "@playwright/test";
import { test, expect, SAMPLE_DOC } from "./support/fixtures";
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

/** A word the built docs index actually matches, so results render. */
const SEARCH_QUERY = "resume";

/** Nonsense the index cannot match, exercising the "No results" announcement. */
const EMPTY_QUERY = "zzzqqqxyzzy";

/** One press was enough to escape before #672; six proves a real cycle. */
const FOCUS_WALK_PRESSES = 6;

/** The component debounces its announcement by 400 ms; outlast it with margin. */
const STATUS_SETTLE_MS = 900;

/** Page background well clear of the sticky header and the search panel. */
const BEHIND_PANEL_POINT = { x: 6, y: 320 } as const;

/** Counter the in-page MutationObserver below writes to, parked on `window`. */
interface StatusWriteCounter {
  writes: number;
}

type WindowWithCounter = Window & { statusWrites?: StatusWriteCounter };

/**
 * Starts counting writes to the search status region.
 *
 * Writes to the live region are counted rather than renders of the visible
 * Pagefind message: the debounce is a property of the announcement, and an
 * undebounced mirror would write once per character of the query.
 */
async function startCountingStatusWrites(page: Page): Promise<void> {
  await page.evaluate(() => {
    const region = document.querySelector('[role="status"]#search-status');
    if (!region) throw new Error("the search status region is missing");
    const counter = { writes: 0 };
    (window as WindowWithCounter).statusWrites = counter;
    new MutationObserver(() => {
      counter.writes += 1;
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
}

/** Reads the counter back, failing loudly if the observer never installed. */
async function readStatusWrites(page: Page): Promise<number> {
  const counter = await page.evaluate(() => (window as WindowWithCounter).statusWrites);
  if (!counter) {
    throw new Error("the status write counter was never installed");
  }
  return counter.writes;
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

  /**
   * Focus containment and status announcements are behavioural: axe sees one
   * rendered frame, so `aria-dialog-name` passing said nothing about Tab
   * walking out of the dialog, and a `<p>` holding the result count is valid
   * markup no rule objects to. Rustume#672 / #673.
   */
  test("search dialog keeps Tab inside it and inerts the page behind", async ({
    page,
    docsPage,
  }) => {
    await docsPage.open(SAMPLE_DOC.slug);
    await docsPage.openSearch();
    await docsPage.assertPageInertForSearch();

    // With results rendered the panel holds many focusables, so six presses
    // exercise a real cycle instead of trivially landing on the lone input.
    await docsPage.searchFor(SEARCH_QUERY);

    for (let press = 1; press <= FOCUS_WALK_PRESSES; press += 1) {
      await page.keyboard.press("Tab");
      expect(
        await docsPage.isFocusInSearchDialog(),
        `Tab ${press} left the dialog, landing on ${await docsPage.focusedDescription()}`,
      ).toBe(true);
    }

    // Shift+Tab off the first control wraps to the last rather than escaping
    // backwards into the header controls behind the panel.
    await docsPage.searchInput.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await docsPage.isFocusInSearchDialog()).toBe(true);
    await expect(docsPage.searchInput).not.toBeFocused();

    await docsPage.closeSearch();
    await docsPage.assertPageNotInert();
    await expect(docsPage.searchTrigger).toBeFocused();
  });

  test("clicking the page behind still closes the search dialog", async ({ page, docsPage }) => {
    await docsPage.open(SAMPLE_DOC.slug);
    await docsPage.openSearch();

    // Guards the containment fix: the close-on-outside-click handler listens on
    // `document`, and the page behind is now inert. Inert subtrees do not
    // receive targeted clicks, so the listener only still fires because the
    // event retargets to a non-inert ancestor.
    // A raw coordinate rather than a locator: `body > main` is aria-hidden
    // while the dialog is open, so a role locator cannot reach it, and the
    // far-left gutter is clear of both the header controls and the panel.
    await page.mouse.click(BEHIND_PANEL_POINT.x, BEHIND_PANEL_POINT.y);
    await expect(docsPage.searchDialog).toBeHidden();
    await expect(docsPage.searchTrigger).toHaveAttribute("aria-expanded", "false");
    await docsPage.assertPageNotInert();
    // Deliberately no focus assertion: the pointer path is documented not to
    // steal focus (the mousedown has already blurred the panel by the time the
    // handler runs), unlike the keyboard dismissal covered above.
  });

  test("search result count is announced politely, including no results", async ({ docsPage }) => {
    await docsPage.open(SAMPLE_DOC.slug);
    await docsPage.openSearch();

    await docsPage.searchFor(SEARCH_QUERY);
    // The announcement must say exactly what the sighted user reads.
    await expect(docsPage.searchStatus).toHaveText(
      (await docsPage.searchMessage.innerText()).trim(),
    );
    await expect(docsPage.searchStatus).toContainText(SEARCH_QUERY);

    await docsPage.searchFor(EMPTY_QUERY);
    await expect(docsPage.searchStatus).toHaveText(
      (await docsPage.searchMessage.innerText()).trim(),
    );
    await expect(docsPage.searchStatus).toContainText(EMPTY_QUERY);
  });

  test("a dismissed dialog announces nothing when Pagefind keeps repainting", async ({
    page,
    docsPage,
  }) => {
    await docsPage.open(SAMPLE_DOC.slug);
    await docsPage.openSearch();
    await docsPage.searchFor(SEARCH_QUERY);
    await expect(docsPage.searchStatus).toContainText(SEARCH_QUERY);

    // Dismissed by pointer, deliberately. Escape reaches Pagefind's own input
    // first and clears its query, which tears the message node down with it, so
    // that path leaves nothing to announce and cannot exercise this. The
    // pointer path leaves the query and its result count standing.
    await page.mouse.click(BEHIND_PANEL_POINT.x, BEHIND_PANEL_POINT.y);
    await expect(docsPage.searchDialog).toBeHidden();
    await startCountingStatusWrites(page);

    // Pagefind owns #search-input-container and keeps mutating it after the
    // dialog is gone. Clearing the in-flight timer in closeSearch() does not
    // stop that on its own: the observer stays attached for the life of the
    // page, so any later mutation re-arms the timer it just cleared. Stand in
    // for one such mutation — the message node is left in place, so an
    // unguarded observer would mirror its count into the region and read a
    // result count out over a dialog the user has already dismissed.
    await page.evaluate(() => {
      const container = document.getElementById("search-input-container");
      if (!container) throw new Error("the Pagefind container is missing");
      container.appendChild(document.createElement("span"));
    });

    // Outlast the debounce: the claim is that no announcement arrives, and an
    // absence is only observable across the window one could have arrived in.
    await page.waitForTimeout(STATUS_SETTLE_MS);
    expect(await readStatusWrites(page)).toBe(0);
    await expect(docsPage.page.locator("#search-status")).toHaveText("");
  });

  test("repeating a query after reopening still announces the count", async ({
    page,
    docsPage,
  }) => {
    await docsPage.open(SAMPLE_DOC.slug);
    await docsPage.openSearch();
    await docsPage.searchFor(SEARCH_QUERY);
    await expect(docsPage.searchStatus).toContainText(SEARCH_QUERY);

    await docsPage.closeSearch();
    // The region is emptied on close, not merely left holding the last count.
    // publishSearchStatus() skips writing text identical to what is already
    // there, so a count carried across sessions would make the same query on
    // reopen announce nothing at all.
    //
    // Located by id rather than by role: the closed dialog is out of the
    // accessibility tree, so `searchStatus` matches nothing here — which is the
    // point of the region being silent while dismissed.
    await expect(docsPage.page.locator("#search-status")).toHaveText("");

    await docsPage.openSearch();
    // Installed after reopen so it counts only this session's announcements.
    await startCountingStatusWrites(page);
    await docsPage.searchFor(SEARCH_QUERY);

    // A write is the assertion, not the text: the stale text would satisfy any
    // content check while announcing nothing, because a live region only speaks
    // when it changes. Outlast the debounce so the absence is real.
    await page.waitForTimeout(STATUS_SETTLE_MS);
    expect(await readStatusWrites(page)).toBeGreaterThanOrEqual(1);
    await expect(docsPage.searchStatus).toContainText(SEARCH_QUERY);
  });

  test("typing a query collapses to fewer announcements than keystrokes", async ({
    page,
    docsPage,
  }) => {
    await docsPage.open(SAMPLE_DOC.slug);
    await docsPage.openSearch();
    await startCountingStatusWrites(page);

    // Typed as a burst, the way someone types a word.
    await docsPage.searchInput.pressSequentially(SEARCH_QUERY);
    await expect(docsPage.searchStatus).toContainText(SEARCH_QUERY);

    // A duration, deliberately: the claim includes that no further write
    // arrives, and the only way to observe an absence is to outlast the window
    // one could arrive in. Sized off the component's own 400 ms debounce.
    await page.waitForTimeout(STATUS_SETTLE_MS);
    const writes = await readStatusWrites(page);

    // Bounded rather than pinned to 1, which the test name reflects. Collapsing
    // a burst to strictly fewer writes than keystrokes is the defining property
    // of the debounce, and it is what fails loudly if the debounce is removed —
    // an undebounced mirror writes once per character. Pinning it to exactly 1
    // instead measures the machine: a keystroke gap wider than 400 ms is a
    // legitimate second query, and a loaded CI worker produces those.
    expect(writes).toBeGreaterThanOrEqual(1);
    expect(writes).toBeLessThan(SEARCH_QUERY.length);
  });
});
