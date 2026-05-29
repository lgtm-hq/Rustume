/** Rustume access comparison: open-source operation or Rustume-operated hosting. */

export const PRICING_HEADERS = {
  selfHosted: { label: "Self-hosted OSS", price: "$0" },
  cloud: { label: "Rustume Cloud", price: "Hosted access" },
};

/** @typedef {{ text: string, accent?: boolean }} PricingCell */

const INCLUDED = "✅";
const NOT_APPLICABLE = "-";

/** @type {Array<{ feature: string, selfHosted: PricingCell, cloud: PricingCell, capability?: boolean }>} */
export const PRICING_OPTIONS = [
  {
    feature: "Resume builder and all templates",
    selfHosted: { text: INCLUDED },
    cloud: { text: INCLUDED },
    capability: true,
  },
  {
    feature: "Multiple resumes",
    selfHosted: { text: INCLUDED },
    cloud: { text: INCLUDED },
    capability: true,
  },
  {
    feature: "Cloud sync",
    selfHosted: { text: "Configure and operate" },
    cloud: { text: "Ready after sign-in", accent: true },
    capability: true,
  },
  {
    feature: "Public pages and protected sharing",
    selfHosted: { text: INCLUDED },
    cloud: { text: INCLUDED },
    capability: true,
  },
  {
    feature: "Version history",
    selfHosted: { text: INCLUDED },
    cloud: { text: INCLUDED },
    capability: true,
  },
  {
    feature: "API keys",
    selfHosted: { text: INCLUDED },
    cloud: { text: INCLUDED },
    capability: true,
  },
  {
    feature: "Deployment and upgrades",
    selfHosted: { text: "You operate" },
    cloud: { text: "Managed", accent: true },
  },
  {
    feature: "Database, backups, and monitoring",
    selfHosted: { text: "You operate" },
    cloud: { text: "Managed", accent: true },
  },
  {
    feature: "Rustume-hosted account",
    selfHosted: { text: NOT_APPLICABLE },
    cloud: { text: INCLUDED },
  },
];
