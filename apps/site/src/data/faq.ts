/** Site-wide FAQ sourced from and linked to across the docs. */

export const FAQ_CATEGORIES = [
  "general",
  "self-hosting",
  "cloud",
  "pricing",
  "privacy",
  "data",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  general: "General",
  "self-hosting": "Self-hosting",
  cloud: "Rustume Cloud",
  pricing: "Hosting and billing",
  privacy: "Privacy and encryption",
  data: "Data and import",
};

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  /** Optional doc path for "learn more" (relative to site base). */
  learnMore?: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-rustume",
    category: "general",
    question: "What is Rustume?",
    answer:
      "Rustume is a privacy-first resume builder: a SolidJS web app backed by a Rust API. Use it locally, self-host it, or sign in to the operated Rustume Cloud service for ready-to-use synchronization.",
    learnMore: "docs/getting-started/quickstart/",
  },
  {
    id: "self-host-vs-cloud",
    category: "self-hosting",
    question: "Do I need hosted Rustume Cloud to store my resumes?",
    answer:
      "No. Browser-local Rustume stores resumes on your device without an account, and a self-hosted connected deployment can provide account-backed storage and sync. Hosted Cloud removes the deployment and operations work.",
    learnMore: "docs/cloud/overview/",
  },
  {
    id: "self-host-and-cloud",
    category: "self-hosting",
    question: "Can I run the connected features myself?",
    answer:
      "Yes. Configure Cloud mode with your own PostgreSQL database, WorkOS credentials, and deployment controls. Self-hosted connected Rustume supports the same product capabilities as the hosted service.",
    learnMore: "docs/deployment/env-reference/",
  },
  {
    id: "local-version-history",
    category: "self-hosting",
    question: "Can self-hosted Rustume provide version history?",
    answer:
      "Yes, when you run a connected deployment. Browser-only storage is intentionally local, while connected mode provides synchronized storage and version restoration on infrastructure you operate.",
    learnMore: "docs/cloud/version-history/",
  },
  {
    id: "host-cloud-mode",
    category: "self-hosting",
    question: "What do I operate when I self-host connected mode?",
    answer:
      "You operate identity configuration, storage, backups, monitoring, upgrades, and availability. Rustume Cloud exists for users who prefer those responsibilities already handled.",
    learnMore: "docs/architecture/cloud-stack/",
  },
  {
    id: "sign-up-cloud",
    category: "cloud",
    question: "Can I sign up for hosted Rustume Cloud?",
    answer:
      "Yes. Hosted Rustume Cloud is the ready-to-use deployment: sign in, create or import resumes, and synchronize them across devices without configuring server infrastructure.",
    learnMore: "docs/cloud/getting-started/",
  },
  {
    id: "import-local-to-cloud",
    category: "cloud",
    question: "Can I move local resumes into Rustume Cloud?",
    answer:
      "Yes. After signing in, import local resumes into account-backed storage. Local copies remain on the device, and the stored versions can participate in sync and history.",
    learnMore: "docs/cloud/getting-started/",
  },
  {
    id: "free-cloud-account",
    category: "cloud",
    question: "Does paying for Cloud unlock additional Rustume features?",
    answer:
      "No. Hosted access pays for a deployed and operated service. The open-source connected application may provide the same storage, sync, sharing, history, and API capabilities when you host it yourself.",
    learnMore: "docs/pricing/plans/",
  },
  {
    id: "offline-cloud",
    category: "cloud",
    question: "Does Rustume Cloud work offline?",
    answer:
      "Connected Rustume supports offline work with queued synchronization when a device reconnects, including conflict handling for diverged edits.",
    learnMore: "docs/cloud/sync/",
  },
  {
    id: "public-pages",
    category: "cloud",
    question: "How do public resume pages work?",
    answer:
      "Publishing is opt-in. Connected deployments let you publish a selected read-only resume, add password protection when appropriate, and unpublish it again.",
    learnMore: "docs/cloud/public-pages/",
  },
  {
    id: "plans-compared",
    category: "pricing",
    question: "What am I paying for with hosted Rustume Cloud?",
    answer:
      "You pay for an already deployed application and operated synchronization service, including storage operations, backups, monitoring, and updates. Product capabilities are not reserved for subscribers.",
    learnMore: "docs/pricing/plans/",
  },
  {
    id: "cancel-subscription",
    category: "pricing",
    question: "What happens if I stop hosted access?",
    answer:
      "Hosted access and its data-retention terms apply to the operated service. Export portable data before ending access when needed; the open-source application remains available for self-hosting.",
    learnMore: "docs/pricing/management/",
  },
  {
    id: "paddle-mor",
    category: "pricing",
    question: "Why does Rustume Cloud use Paddle for payments?",
    answer:
      "Paddle acts as Merchant of Record for hosted-service payment, invoicing, and tax handling. Billing grants use of operated hosting, not exclusive application features.",
    learnMore: "docs/pricing/checkout/",
  },
  {
    id: "personal-data",
    category: "privacy",
    question: "What personal data does Rustume Cloud store?",
    answer:
      "Rustume links accounts with an opaque WorkOS identifier rather than copying profile fields into its account record. Resume documents can contain personal data and must be protected accordingly.",
    learnMore: "docs/cloud/auth/",
  },
  {
    id: "e2e-encryption",
    category: "privacy",
    question: "What is end-to-end encryption?",
    answer:
      "Optional end-to-end encryption encrypts a resume in the browser using user-held secret material before storage, limiting what the hosting operator can read without user participation.",
    learnMore: "docs/cloud/encryption/",
  },
  {
    id: "self-host-encryption",
    category: "privacy",
    question: "Is encryption available to self-hosted connected deployments?",
    answer:
      "Yes. Encryption is a connected Rustume capability, not a paid-only hosted option. Self-hosted operators remain responsible for keys, database access, backups, and telemetry configuration.",
    learnMore: "docs/cloud/encryption/",
  },
  {
    id: "import-formats",
    category: "data",
    question: "Which resume formats can I import?",
    answer:
      "JSON Resume, LinkedIn export ZIP, Reactive Resume (rrv3), and native Rustume JSON. The parser normalizes all formats into Rustume's unified schema.",
    learnMore: "docs/getting-started/import-formats/",
  },
  {
    id: "reactive-resume-name",
    category: "data",
    question: "Why do the docs say Reactive Resume instead of rrv3?",
    answer:
      "Reactive Resume is the user-facing product name. rrv3 is the format identifier used in code and API tables when referring to the import format.",
    learnMore: "docs/getting-started/import-formats/",
  },
  {
    id: "api-keys-scope",
    category: "data",
    question: "What can API keys do?",
    answer:
      "Scoped API keys authorize programmatic connected workflows such as resume operations and rendering without sharing a browser session. They are available in hosted and self-hosted connected deployments.",
    learnMore: "docs/api/api-keys/",
  },
];

export function faqByCategory(category: FaqCategory): FaqItem[] {
  return FAQ_ITEMS.filter((item) => item.category === category);
}
