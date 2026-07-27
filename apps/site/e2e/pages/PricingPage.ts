import { expect, type Locator, type Page } from "@playwright/test";
import DocsPage from "./DocsPage";

/** Docs slug that renders the hosting-options comparison table. */
const PRICING_SLUG = "pricing/plans";

/** Pricing page — the docs entry that embeds `PricingTable.astro`. */
export default class PricingPage extends DocsPage {
  /** Plan comparison table, identified by its leading column header. */
  readonly plansTable: Locator;

  constructor(page: Page) {
    super(page);
    this.plansTable = page
      .getByRole("table")
      .filter({ has: page.getByRole("columnheader", { name: "Feature" }) });
  }

  async open(): Promise<void> {
    await super.open(PRICING_SLUG);
  }

  /** The comparison table is rendered with a header row per plan. */
  async assertPlansTableVisible(): Promise<void> {
    await expect(this.plansTable).toBeVisible();
    await expect(this.plansTable.getByRole("columnheader")).toHaveCount(3);
  }
}
