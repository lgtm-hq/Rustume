/** Current Terms of Service version (ISO date). Must match `crates/server/src/config.rs`. */
export const TERMS_VERSION = "2026-07-10";

/** Current Privacy Policy version (ISO date). Must match `crates/server/src/config.rs`. */
export const PRIVACY_VERSION = "2026-07-10";

/** Human-readable effective date derived from the version string. */
export function formatPolicyEffectiveDate(version: string): string {
  const parsed = new Date(`${version}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return version;
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
