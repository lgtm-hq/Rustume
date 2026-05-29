import { describe, expect, it } from "vitest";
import { PRICING_OPTIONS } from "./pricing-tiers.mjs";

describe("hosting options", () => {
  it("does not gate product capabilities behind hosted access", () => {
    const capabilities = PRICING_OPTIONS.filter((row) => row.capability);

    expect(capabilities).toHaveLength(6);
    for (const row of capabilities) {
      expect(row.selfHosted.text).not.toBe("-");
      expect(row.cloud.text).not.toBe("-");
    }
  });

  it("distinguishes hosted operation from self-managed operation", () => {
    const values = PRICING_OPTIONS.flatMap((row) => [row.selfHosted.text, row.cloud.text]);

    expect(values).toContain("Ready after sign-in");
    expect(values).toContain("You operate");
    expect(values).toContain("Managed");
    expect(values).toContain("✅");
    expect(values).toContain("-");
  });
});
