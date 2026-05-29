import { describe, expect, it } from "vitest";
import {
  CORE_DOC_CATEGORIES,
  DOC_CATEGORIES,
  STANDALONE_DOC_CATEGORIES,
  buildMainNav,
  isStandaloneCategory,
} from "./docs-nav";

const mockDocs = [
  { id: "cli/usage", data: { title: "CLI Usage", category: "cli" as const, order: 10 } },
  { id: "pricing/plans", data: { title: "Plans", category: "pricing" as const, order: 10 } },
  {
    id: "cloud/storage",
    data: { title: "Storage", category: "cloud" as const, order: 10 },
  },
  {
    id: "cloud/sync",
    data: { title: "Sync", category: "cloud" as const, order: 20 },
  },
  {
    id: "api/overview",
    data: { title: "API Overview", category: "api" as const, order: 10 },
  },
  {
    id: "api/cloud-endpoints",
    data: { title: "Cloud Endpoints", category: "api" as const, order: 20 },
  },
  {
    id: "operations/monitoring",
    data: { title: "Monitoring", category: "operations" as const, order: 10 },
  },
  {
    id: "getting-started/quickstart",
    data: { title: "Quickstart", category: "getting-started" as const, order: 10 },
  },
];

describe("docs-nav", () => {
  it("covers every category exactly once between core and standalone", () => {
    const combined = [...CORE_DOC_CATEGORIES, ...STANDALONE_DOC_CATEGORIES].sort();
    expect(combined).toEqual([...DOC_CATEGORIES].sort());
  });

  it("marks standalone sections", () => {
    expect(isStandaloneCategory("cli")).toBe(true);
    expect(isStandaloneCategory("pricing")).toBe(true);
    expect(isStandaloneCategory("deployment")).toBe(false);
  });

  it("includes Pricing, FAQ, and API in navbar", () => {
    const labels = buildMainNav("/Rustume/", []).map((link) => link.label);
    expect(labels).toContain("Pricing");
    expect(labels).toContain("FAQ");
    expect(labels).toContain("API");
    expect(labels).toContain("CLI");
    expect(labels).toContain("Templates");
  });

  it("builds dropdown groups from docs collection", () => {
    const nav = buildMainNav("/Rustume/", mockDocs);
    const docsItem = nav.find((n) => n.label === "Docs");
    expect(docsItem?.groups.some((g) => g.label === "Getting Started")).toBe(true);
    expect(docsItem?.groups.find((g) => g.label === "Getting Started")?.items[0]?.label).toBe(
      "Quickstart",
    );
    expect(docsItem?.groups.find((g) => g.label === "Operations")?.items[0]?.label).toBe(
      "Monitoring",
    );

    const cliItem = nav.find((n) => n.label === "CLI");
    expect(cliItem?.groups[0]?.items).toHaveLength(1);

    const cloudItem = nav.find((n) => n.label === "Cloud");
    expect(
      cloudItem?.groups.find((g) => g.label === "Guides")?.items.map((item) => item.label),
    ).toEqual(["Storage", "Sync"]);

    const apiItem = nav.find((n) => n.label === "API");
    expect(
      apiItem?.groups.find((g) => g.label === "Reference")?.items.map((item) => item.label),
    ).toEqual(["API Overview", "Cloud Endpoints"]);
  });
});
