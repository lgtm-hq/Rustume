import { expect, type Locator, type Page } from "@playwright/test";

/** Shared chrome (app shell) locators and assertions for all pages. */
export default class BasePage {
  /** Amber fallback banner rendered when the WASM module fails to load. */
  readonly wasmFallbackNotice: Locator;

  /** Header logo link — navigates home without a full page load. */
  readonly homeLink: Locator;

  constructor(readonly page: Page) {
    this.wasmFallbackNotice = page.getByText(
      "Browser import features are using the server fallback",
    );
    this.homeLink = page.getByRole("link", { name: "Rustume" });
  }

  /** Client-side navigation back to the home page via the header logo. */
  async goHome(): Promise<void> {
    await this.homeLink.click();
  }

  async assertUrl(path: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(path);
  }

  /** The app booted with a working WASM module (no fallback banner). */
  async assertWasmLoaded(): Promise<void> {
    await expect(this.wasmFallbackNotice).toBeHidden();
  }
}
