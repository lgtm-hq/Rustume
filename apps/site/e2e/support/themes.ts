import type { Page } from "@playwright/test";
import {
  NATIVE_THEME,
  themeAppearances,
  themeTriggerLabels,
  validThemeIds,
} from "../../src/data/themes";

/** A theme as the suite addresses it: an id, its menu label, its appearance. */
export interface ThemeUnderTest {
  /** `data-theme` value, and the theme stylesheet basename for turbo themes. */
  id: string;
  /** Accessible name of the theme's option in the theme listbox. */
  label: string;
  /** Light or dark, as declared by `src/data/themes`. */
  appearance: "light" | "dark";
  /** The site-native Craft theme, whose tokens ship in `craft-theme.css`. */
  native: boolean;
}

/**
 * Ids scanned by the accessibility suite. The full catalog is 40+ flavors —
 * scanning all of them on every surface buys near-nothing (structure is
 * theme-independent) for a multi-minute run. These three cover the three
 * distinct ways the page can be painted: the native stylesheet (theme link
 * disabled), a linked light turbo theme, and a linked dark turbo theme.
 */
const SCANNED_THEME_IDS = [NATIVE_THEME, "catppuccin-latte", "dracula"] as const;

/** Resolves an id to the label and appearance the site itself declares. */
export function describeTheme(id: string): ThemeUnderTest {
  if (!validThemeIds.includes(id)) {
    throw new Error(`Unknown theme id "${id}" — it is not in src/data/themes`);
  }
  const label = themeTriggerLabels[id];
  const appearance = themeAppearances[id];
  if (!label || !appearance) {
    throw new Error(`Theme "${id}" has no menu label or appearance in src/data/themes`);
  }
  return { id, label, appearance, native: id === NATIVE_THEME };
}

/** Labels are read from the site's own data so a relabel upstream can't
 * silently turn these locators into misses. */
export const SCANNED_THEMES: ThemeUnderTest[] = SCANNED_THEME_IDS.map(describeTheme);

/** The theme every page boots with when local storage is empty. */
export const DEFAULT_THEME_UNDER_TEST = describeTheme(NATIVE_THEME);

/**
 * Resolves once the requested theme has actually painted.
 *
 * Ported from turbo-themes' `e2e/helpers/stylesheet-utils.ts`. `data-theme`
 * and the stylesheet `href` both flip synchronously in `applyTheme`, well
 * before the new sheet's custom properties reach computed style — so asserting
 * on either alone lets a scan run mid-swap. The check that matters is the last
 * one: read `--turbo-brand-primary` out of the theme stylesheet's own rules and
 * wait until the computed value on `<html>` agrees.
 *
 * Unlike upstream this does not swallow the timeout. A theme that never
 * finishes applying is a real defect, and hiding it would hand the scan a page
 * painted in the previous theme.
 */
export async function waitForThemeApplied(
  page: Page,
  theme: ThemeUnderTest,
  timeoutMs = 5_000,
): Promise<void> {
  await page.waitForFunction(
    (expected: ThemeUnderTest) => {
      const root = document.documentElement;
      if (root.dataset.theme !== expected.id) return false;
      if (root.dataset.appearance !== expected.appearance) return false;

      const computed = getComputedStyle(root);
      if (!computed.getPropertyValue("--turbo-bg-base").trim()) return false;

      const link = document.getElementById("turbo-theme-css");
      if (!(link instanceof HTMLLinkElement)) return false;

      // Craft paints from craft-theme.css; the turbo theme link stays disabled.
      if (expected.native) return link.disabled;

      if (link.disabled) return false;
      if (!link.href.includes(`${expected.id}.css`)) return false;

      let sheetRules: CSSRuleList;
      try {
        if (!link.sheet) return false;
        sheetRules = link.sheet.cssRules;
      } catch {
        // Sheet not parsed yet.
        return false;
      }

      let expectedBrand = "";
      for (const rule of Array.from(sheetRules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        const value = rule.style.getPropertyValue("--turbo-brand-primary").trim();
        if (value) {
          expectedBrand = value;
          break;
        }
      }
      if (!expectedBrand) return false;

      return computed.getPropertyValue("--turbo-brand-primary").trim() === expectedBrand;
    },
    theme,
    { timeout: timeoutMs },
  );
}
