import { describe, expect, it } from "vitest";
import { FAQ_CATEGORIES, FAQ_ITEMS, faqByCategory } from "./faq";

describe("faq", () => {
  it("has unique ids", () => {
    const ids = FAQ_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every category", () => {
    for (const category of FAQ_CATEGORIES) {
      expect(faqByCategory(category).length).toBeGreaterThan(0);
    }
  });

  it("includes self-host vs cloud distinction", () => {
    expect(FAQ_ITEMS.some((item) => item.id === "self-host-vs-cloud")).toBe(true);
    expect(FAQ_ITEMS.some((item) => item.id === "host-cloud-mode")).toBe(true);
  });

  it("states that hosted payment is for operation rather than product entitlements", () => {
    const pricingAnswer = FAQ_ITEMS.find((item) => item.id === "plans-compared")?.answer;
    const accessAnswer = FAQ_ITEMS.find((item) => item.id === "free-cloud-account")?.answer;

    expect(pricingAnswer).toContain("Product capabilities are not reserved for subscribers");
    expect(accessAnswer).toContain("Hosted access pays for a deployed and operated service");
  });
});
