/** Canonical internal paths (relative to site base, trailing slash). */
export const docs = {
  quickstart: "docs/getting-started/quickstart/",
  templates: "docs/getting-started/templates/",
  selfHosting: "docs/deployment/self-hosting/",
  docker: "docs/deployment/docker/",
  architectureOverview: "docs/architecture/overview/",
  webApp: "docs/contributing/web-app/",
  cloud: "cloud/",
  cloudOverview: "docs/cloud/overview/",
  cloudEncryption: "docs/cloud/encryption/",
  cloudStorage: "docs/cloud/storage/",
  cloudSync: "docs/cloud/sync/",
  cloudPublicPages: "docs/cloud/public-pages/",
  pricingPlans: "docs/pricing/plans/",
  faq: "faq/",
  importFormats: "docs/getting-started/import-formats/",
  cliUsage: "docs/cli/usage/",
  apiKeys: "docs/api/api-keys/",
  apiOverview: "docs/api/overview/",
} as const;

export const home = {
  label: "Rustume",
  href: "/",
} as const;

export const external = {
  rust: {
    label: "Rust",
    href: "https://www.rust-lang.org/",
  },
  typst: {
    label: "Typst",
    href: "https://typst.app/",
  },
  github: {
    label: "GitHub",
    href: "https://github.com/lgtm-hq/Rustume",
  },
  indexedDb: {
    label: "IndexedDB",
    href: "https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API",
  },
  wasm: {
    label: "WASM",
    href: "https://developer.mozilla.org/en-US/docs/WebAssembly",
  },
  postgresql: {
    label: "PostgreSQL",
    href: "https://www.postgresql.org/",
  },
  jsonResume: {
    label: "JSON Resume",
    href: "https://jsonresume.org/",
  },
  linkedin: {
    label: "LinkedIn",
    href: "https://www.linkedin.com/",
  },
  reactiveResume: {
    label: "Reactive Resume",
    href: "https://rxresu.me/",
  },
  pwa: {
    label: "PWA",
    href: "https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps",
  },
} as const;

export function docHref(base: string, path: string): string {
  const trimmedBase = base.trim().replace(/\/+$/, "");
  const normalizedBase =
    trimmedBase === "" || trimmedBase === "/"
      ? "/"
      : `${trimmedBase.startsWith("/") ? trimmedBase : `/${trimmedBase}`}/`;
  const normalizedPath = path.trim().replace(/^\/+/, "").replace(/\/+/g, "/");
  return normalizedPath.length > 0 ? `${normalizedBase}${normalizedPath}` : normalizedBase;
}
