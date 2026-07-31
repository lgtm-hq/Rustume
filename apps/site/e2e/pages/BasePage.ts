import { expect, type Locator, type Page } from "@playwright/test";
import { describeTheme, waitForThemeApplied, type ThemeUnderTest } from "../support/themes";

/** Shared chrome (header, search, theme picker) for every site page. */
export default class BasePage {
  /** Bypass link, the first thing keyboard users reach. */
  readonly skipLink: Locator;

  /** Header landmark. */
  readonly header: Locator;

  /** Header logo link — navigates to the site root. */
  readonly brandLink: Locator;

  /** Primary navigation landmark in the header. */
  readonly mainNav: Locator;

  /** Main content landmark. */
  readonly main: Locator;

  /** Theme picker trigger in the header controls. */
  readonly themeTrigger: Locator;

  /** Theme picker listbox, rendered only while the picker is open. */
  readonly themePanel: Locator;

  /** Polite live region the picker writes the newly applied theme into. */
  readonly themeStatus: Locator;

  /** Search trigger in the header controls. */
  readonly searchTrigger: Locator;

  /** Search dialog, revealed by the trigger or Cmd/Ctrl+K. */
  readonly searchDialog: Locator;

  /** Pagefind's query input, mounted into the dialog on first open. */
  readonly searchInput: Locator;

  /** Pagefind's visible result-count line ("31 results for resume"). */
  readonly searchMessage: Locator;

  /** Polite region mirroring the result count for assistive tech. */
  readonly searchStatus: Locator;

  constructor(readonly page: Page) {
    this.skipLink = page.getByRole("link", { name: "Skip to content" });
    this.header = page.getByRole("banner");
    this.brandLink = this.header.getByRole("link", { name: "Rustume", exact: true });
    this.mainNav = page.getByRole("navigation", { name: "Main" });
    this.main = page.getByRole("main");
    this.themeTrigger = page.getByRole("button", { name: "Select theme" });
    this.themePanel = page.getByRole("listbox", { name: "Themes" });
    // Scoped to the picker: `role=status` is the user-facing handle, and the
    // header will grow other status regions (docs search count, Rustume#673).
    this.themeStatus = page.locator("#theme-picker").getByRole("status");
    this.searchTrigger = page.getByRole("button", { name: "Search", exact: true });
    this.searchDialog = page.getByRole("dialog", { name: "Search" });
    this.searchInput = this.searchDialog.getByRole("textbox", { name: "Search" });
    this.searchMessage = this.searchDialog.locator(".pagefind-ui__message");
    this.searchStatus = this.searchDialog.getByRole("status");
  }

  /** Navigates to `path` and waits for the shared chrome to be present. */
  async open(path: string): Promise<void> {
    await this.page.goto(path);
    await this.assertChromeReady();
  }

  /** Header, nav and main landmarks are rendered and the theme has painted. */
  async assertChromeReady(): Promise<void> {
    await expect(this.brandLink).toBeVisible();
    await expect(this.mainNav).toBeVisible();
    await expect(this.main).toBeVisible();
    await expect(this.themeTrigger).toHaveAttribute("aria-expanded", "false");
    // The boot theme is applied from local storage by an inline script, so a
    // page can be laid out before its stylesheet has painted.
    await this.assertBootThemeApplied();
  }

  /** Whatever theme the page booted with has finished painting. */
  async assertBootThemeApplied(): Promise<void> {
    const themeId = await this.page.locator("html").getAttribute("data-theme");
    if (!themeId) {
      throw new Error("The page did not declare a theme on <html data-theme>");
    }
    await waitForThemeApplied(this.page, describeTheme(themeId));
  }

  async assertUrl(path: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(path);
  }

  /** Opens the theme picker and waits for its listbox. */
  async openThemeMenu(): Promise<void> {
    await this.themeTrigger.click();
    await expect(this.themeTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(this.themePanel).toBeVisible();
  }

  /** Option row for a theme, addressed by the label the user reads. */
  themeOption(theme: ThemeUnderTest): Locator {
    return this.themePanel.getByRole("option", { name: theme.label, exact: true });
  }

  /**
   * Option row addressed by theme id. Menu labels are shortened per vendor
   * group ("Solarized Light" renders as "Light"), so they are not unique
   * across the listbox — id is the only handle that always resolves to one
   * option.
   */
  themeOptionById(themeId: string): Locator {
    return this.themePanel.locator(`[data-theme-id="${themeId}"]`);
  }

  /**
   * Switches themes the way a visitor does — open the picker, click the
   * option — and returns once the new theme has actually painted.
   */
  async applyTheme(theme: ThemeUnderTest): Promise<void> {
    await this.openThemeMenu();
    await this.themeOption(theme).click();
    await expect(this.themePanel).toBeHidden();
    await this.assertThemeApplied(theme);
  }

  /**
   * Guarantees `theme` is the painted theme: switches via the picker when the
   * page booted on a different one, and otherwise just waits for the boot
   * theme to finish painting.
   */
  async useTheme(theme: ThemeUnderTest): Promise<void> {
    const current = await this.page.locator("html").getAttribute("data-theme");
    if (current === theme.id) {
      await this.assertThemeApplied(theme);
      return;
    }
    await this.applyTheme(theme);
  }

  /** The requested theme is painted and reflected in the picker trigger. */
  async assertThemeApplied(theme: ThemeUnderTest): Promise<void> {
    await waitForThemeApplied(this.page, theme);
    await expect(this.themeTrigger).toContainText(theme.label);
  }

  /**
   * Opens the search dialog and waits for its entrance transition to reach the
   * end state. `toHaveCSS` polls for the final computed value, so this waits on
   * the state under test rather than on a duration.
   */
  async openSearch(): Promise<void> {
    await this.searchTrigger.click();
    await this.assertSearchReady();
  }

  /** Opens the search dialog with the Cmd/Ctrl+K shortcut. */
  async openSearchWithShortcut(): Promise<void> {
    await this.page.keyboard.press("ControlOrMeta+k");
    await this.assertSearchReady();
  }

  /**
   * The dialog is open, its entrance transition has reached the end state, and
   * Pagefind has mounted and taken focus. Every step polls the real state, so
   * nothing here is a timing fudge: without the Pagefind wait a scan can run
   * against an empty dialog and report nothing about the search interface.
   */
  async assertSearchReady(): Promise<void> {
    await expect(this.searchTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(this.searchDialog).toBeVisible();
    await expect(this.searchDialog).toHaveCSS("opacity", "1");
    await expect(this.searchInput).toBeVisible();
    await expect(this.searchInput).toBeFocused();
  }

  /** Closes the search dialog with Escape. */
  async closeSearch(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.searchTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(this.searchDialog).toBeHidden();
  }

  /**
   * Runs `query` through the search box and waits for Pagefind to report on
   * *that* query.
   *
   * Anchored on the query text rather than on the message being visible:
   * `fill()` returns immediately and Pagefind's message line is already on
   * screen from any previous search, so a visibility wait is satisfied by the
   * previous result and the caller can go on to assert against stale text.
   * Pagefind names the query in both the hit and the miss message ("31 results
   * for resume", "No results for zzz"), so this holds for either.
   */
  async searchFor(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await expect(this.searchMessage).toContainText(query);
  }

  /**
   * The dialog claims modality and the rest of the page is out of reach.
   * `body > main` stands in for the page behind: it is a sibling of the header
   * the dialog lives in, so it is inert whenever the containment pass ran.
   */
  async assertPageInertForSearch(): Promise<void> {
    await expect(this.searchDialog).toHaveAttribute("aria-modal", "true");
    await expect(this.page.locator("body > main")).toHaveAttribute("inert", "");
    await expect(this.page.locator("body > main")).toHaveAttribute("aria-hidden", "true");
  }

  /**
   * The page behind is reachable again and nothing claims modality.
   *
   * The panel is addressed structurally here rather than by role: once closed
   * it is `visibility: hidden` and correctly absent from the accessibility
   * tree, so a role locator cannot reach it to check the attribute is gone.
   */
  async assertPageNotInert(): Promise<void> {
    await expect(this.page.locator("#search-menu")).not.toHaveAttribute("aria-modal", /.*/);
    await expect(this.page.locator("body > main")).not.toHaveAttribute("inert", /.*/);
    await expect(this.page.locator("body > main")).not.toHaveAttribute("aria-hidden", /.*/);
  }

  /**
   * Whether focus currently sits inside the search panel. Evaluated in the
   * page because the assertion is about `document.activeElement` itself, not
   * about any one element being focused.
   */
  async isFocusInSearchDialog(): Promise<boolean> {
    return this.page.evaluate(() => {
      const active = document.activeElement;
      const menu = document.getElementById("search-menu");
      return !!(active && menu?.contains(active));
    });
  }

  /** Accessible name of whatever holds focus, for readable failure output. */
  async focusedDescription(): Promise<string> {
    return this.page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return "nothing";
      const label = active.getAttribute("aria-label") ?? active.textContent?.trim() ?? "";
      return `${active.tagName.toLowerCase()} "${label.slice(0, 40)}"`;
    });
  }
}
