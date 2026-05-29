/** Shared docs navigation — categories, sidebar groups, and navbar links. */

export const DOC_CATEGORIES = [
  "getting-started",
  "cli",
  "deployment",
  "cloud",
  "pricing",
  "api",
  "architecture",
  "operations",
  "contributing",
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

/** Top-level sections linked from the navbar — no left sidebar; use standalone layout. */
export const STANDALONE_DOC_CATEGORIES: readonly DocCategory[] = [
  "cli",
  "cloud",
  "pricing",
  "api",
] as const;

export const CORE_DOC_CATEGORIES = DOC_CATEGORIES.filter(
  (c) => !STANDALONE_DOC_CATEGORIES.includes(c),
);

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  "getting-started": "Getting Started",
  cli: "CLI",
  deployment: "Deployment",
  cloud: "Rustume Cloud",
  pricing: "Pricing",
  api: "API",
  architecture: "Architecture",
  operations: "Operations",
  contributing: "Contributing",
};

export function isStandaloneCategory(category: DocCategory): boolean {
  return STANDALONE_DOC_CATEGORIES.includes(category);
}

export interface NavDropdownItem {
  label: string;
  href: string;
}

export interface NavDropdownGroup {
  label: string;
  items: NavDropdownItem[];
}

export interface MainNavItem {
  label: string;
  href: string;
  groups: NavDropdownGroup[];
}

export interface DocNavEntry {
  id: string;
  data: {
    title: string;
    category: DocCategory;
    order: number;
  };
}

function docsInCategory(
  docs: DocNavEntry[],
  category: DocCategory,
  base: string,
): NavDropdownItem[] {
  return docs
    .filter((d) => d.data.category === category)
    .sort((a, b) => a.data.order - b.data.order)
    .map((d) => ({
      label: d.data.title,
      href: `${base}docs/${d.id}/`,
    }));
}

function groupsForCategories(
  docs: DocNavEntry[],
  categories: readonly DocCategory[],
  base: string,
): NavDropdownGroup[] {
  return categories
    .map((key) => ({
      label: CATEGORY_LABELS[key],
      items: docsInCategory(docs, key, base),
    }))
    .filter((g) => g.items.length > 0);
}

/** Build navbar items with dropdown groups from the docs collection. */
export function buildMainNav(base: string, docs: DocNavEntry[]): MainNavItem[] {
  const cloudDocs = docsInCategory(docs, "cloud", base);
  const pricingDocs = docsInCategory(docs, "pricing", base);
  const apiDocs = docsInCategory(docs, "api", base);

  return [
    {
      label: "Docs",
      href: `${base}docs/`,
      groups: groupsForCategories(docs, CORE_DOC_CATEGORIES, base),
    },
    {
      label: "Cloud",
      href: `${base}cloud/`,
      groups: [
        {
          label: "Product",
          items: [{ label: "Rustume Cloud", href: `${base}cloud/` }],
        },
        ...(cloudDocs.length > 0 ? [{ label: "Guides", items: cloudDocs }] : []),
      ],
    },
    {
      label: "CLI",
      href: `${base}docs/cli/usage/`,
      groups: [{ label: "CLI", items: docsInCategory(docs, "cli", base) }],
    },
    {
      label: "Pricing",
      href: `${base}docs/pricing/plans/`,
      groups: [{ label: "Hosted access", items: pricingDocs }],
    },
    {
      label: "API",
      href: `${base}docs/api/overview/`,
      groups: [{ label: "Reference", items: apiDocs }],
    },
    {
      label: "Templates",
      href: `${base}docs/getting-started/templates/`,
      groups: [
        {
          label: "Reference",
          items: [{ label: "All 12 templates", href: `${base}docs/getting-started/templates/` }],
        },
      ],
    },
    {
      label: "FAQ",
      href: `${base}faq/`,
      groups: [
        {
          label: "Help",
          items: [
            { label: "All questions", href: `${base}faq/` },
            { label: "Self-hosting vs Cloud", href: `${base}faq/#self-host-vs-cloud` },
            { label: "Pricing", href: `${base}faq/#plans-compared` },
          ],
        },
      ],
    },
  ];
}

/** @deprecated Use buildMainNav — kept for tests that only need labels. */
export function mainNavLinks(base: string): { label: string; href: string }[] {
  return buildMainNav(base, []).map(({ label, href }) => ({ label, href }));
}
