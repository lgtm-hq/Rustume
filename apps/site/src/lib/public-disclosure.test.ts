import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

const SITE_SRC = join(import.meta.dirname, "..");
const ENRICH_DESCRIPTIONS = join(SITE_SRC, "../scripts/doc_enrichment/descriptions.py");

/** Hosted vendors that must not appear in public operations doc frontmatter. */
const RESTRICTED_OPS_VENDOR_NAMES = /\b(?:Neon|Cloudflare\s+R2|Grafana\s+Cloud|Railway)\b/i;

function readSource(path: string): string {
  return readFileSync(join(SITE_SRC, path), "utf8");
}

function frontmatterDescription(markdown: string): string {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) {
    return "";
  }

  try {
    const parsed = parseYaml(match[1]);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return "";
    }
    const description = (parsed as { description?: unknown }).description;
    return typeof description === "string" ? description : "";
  } catch {
    return "";
  }
}

describe("public Cloud disclosure boundary", () => {
  const backups = readSource("content/docs/operations/backups.md");
  const monitoring = readSource("content/docs/operations/monitoring.md");
  const terraform = readSource("content/docs/operations/terraform.md");

  it("keeps hosted operations guidance at the policy level", () => {
    expect(backups).toContain("The hosted service manages database recovery");
    expect(backups).not.toMatch(
      /Restore from dump|Backup health monitoring|\b(?:RPO|RTO)\b|aws s3|endpoint-url/i,
    );
    expect(backups).not.toMatch(/\b\d{1,2}:\d{2}\s*UTC\b/);

    expect(monitoring).toContain("Which metrics are retained and alerted on");
    expect(monitoring).not.toMatch(
      /Production alert thresholds|scrape_configs|static_configs|\b\d+(?:\.\d+)?%\s+for\b/i,
    );

    expect(terraform).toContain("controlled deployment changes");
    expect(terraform).not.toMatch(
      /backend\s+"s3"|bucket naming|Production region|Staging subdomain|terraform\.tfstate/i,
    );

    for (const doc of [backups, monitoring, terraform]) {
      expect(frontmatterDescription(doc)).not.toMatch(RESTRICTED_OPS_VENDOR_NAMES);
    }
  });

  it("keeps enrich-docs operations DESCRIPTIONS policy-level", () => {
    const script = readFileSync(ENRICH_DESCRIPTIONS, "utf8");
    const policyBlock = script.match(
      /OPERATIONS_POLICY_DESCRIPTIONS: dict\[str, str\] = \{([\s\S]*?)\n\}/,
    );
    expect(policyBlock?.[1]).toBeDefined();
    expect(policyBlock?.[1]).not.toMatch(RESTRICTED_OPS_VENDOR_NAMES);
  });

  it("presents hosted access without software feature entitlements", () => {
    const publicProductText = [
      readSource("pages/cloud/index.astro"),
      readSource("content/docs/pricing/plans.md"),
      readSource("content/docs/pricing/plans-body.md"),
      readSource("content/docs/pricing/checkout.md"),
      readSource("data/faq.ts"),
    ].join("\n");

    expect(publicProductText).toContain("Product capabilities are not reserved for subscribers");
    expect(publicProductText).not.toMatch(
      /\bfreemium\b|feature gating based|gated behind|\bPro \(\$|\bTeam \(\$/i,
    );
  });

  it("describes sensitive resume content without a zero-PII claim", () => {
    const privacyText = [
      readSource("content/docs/cloud/overview.md"),
      readSource("content/docs/cloud/storage.md"),
      readSource("data/faq.ts"),
    ].join("\n");

    expect(privacyText).toContain("Resume documents can contain personal data");
    expect(privacyText).not.toMatch(/\bzero[- ]PII\b/i);
  });
});
